class StressManager {
    /**
     * Initializes the StressManager and hooks into the game events.
     */
    initialize() {
        // worked before
        Hooks.on("renderActorSheetWfrp4eCharacter", this._addStressToSheet.bind(this));
        // works after 12V update
        Hooks.on("renderActorSheetWFRP4eCharacter", this._addStressToSheet.bind(this));
        Hooks.on("chatMessage", this._handleChatMessage.bind(this));
        Hooks.on('renderChatLog', this._handleChatLogRender.bind(this));
        Hooks.on("wfrp4e:rollTest", this._processStressTest.bind(this));
    }

    /**
     * Adds stress to the character sheet.
     * @param {ActorSheetWfrp4e} sheet - The character sheet.
     * @param {jQuery} html - The HTML of the character sheet.
     */
    async _addStressToSheet(sheet, html) {
        const mainRowElement = html.find(".tab.main .main-row.second");
        const actor = sheet.actor;
        this._addStressToActor(actor)

        if (mainRowElement) {
            const templatePath = 'modules/wfrp-stress/templates/partials/stress-character-sheet.hbs';
            try {
                const content = await renderTemplate(templatePath, actor);
                mainRowElement.append(content);
            } catch (error) {
                console.error("Error rendering stress template:", error);
            }
        } else {
            console.error("Target element not found for adding stress.");
        }
    }

    /**
     * Handles a stress test for an actor.
     * @param {ActorWfrp4e} actor - The actor to test.
     * @param {String} stressLevel - The level of stress (major, moderate).
     */
    _performStressTest(actor, stressLevel) {
        let difficulty = "average";
        if (stressLevel === "major") {
            difficulty = "hard";
        } else if (stressLevel === "moderate") {
            difficulty = "challenging";
        }

        let skill = actor.getItemTypes("skill").find(i => i.name == game.i18n.localize("NAME.Cool"));
        if (skill) {
            actor.setupSkill(skill, {
                title: game.i18n.format("DIALOG.StressTestTitle", { test: skill.name }),
                stress: stressLevel,
                fields: { difficulty: difficulty }
            }).then(setupData => actor.basicTest(setupData));
        } else {
            actor.setupCharacteristic("wp", {
                title: game.i18n.format("DIALOG.StressTestTitle", { test: game.wfrp4e.config.characteristics["wp"] }),
                stress: stressLevel,
                fields: { difficulty: difficulty }
            }).then(setupData => actor.basicTest(setupData));
        }
    }

    /**
     * Handles the stress button display in the chat.
     * @param {string} testStrength - The strength of the stress test.
     */
    async _postStressTest(testStrength) {
        try {
            const strength = testStrength ? testStrength : "minor"
            const html = await renderTemplate("modules/wfrp-stress/templates/partials/stress-button.hbs", { strength });
            ChatMessage.create({ content: html });
        } catch (error) {
            console.error("Error posting stress test:", error);
        }
    }

    /**
     * Handles chat message events.
     */
    _handleChatMessage(html, content, msg) {
        const commandPattern = /(\S+)/g;
        const commands = content.match(commandPattern);
        const command = commands[0];

        if (command === "/stress") {
            this._postStressTest(commands[1]);
            return false;
        }
    }

    /**
     * Handles click events on stress buttons in the chat log.
     */
    _handleStressButtonClick(event) {
        let strength = $(event.currentTarget).attr("data-strength").toLowerCase();
        if (strength !== "moderate" && strength !== "minor" && strength !== "major") {
            strength = "minor"
        }

        let actors = canvas.tokens.controlled.map(t => t.actor);
        if (actors.length === 0) {
            actors = [game.user.character];
        }
        if (actors.length === 0) {
            return ui.notifications.error(game.i18n.localize("ErrorCharAssigned"));
        }

        actors.forEach(actor => {
            this._performStressTest(actor, strength);
        });
    }

    /**
     * Handles rendering of the chat log.
     */
    _handleChatLogRender(log, html, data) {
        html.on("click", ".stress-button", this._handleStressButtonClick.bind(this));
    }

    /**
     * Processes a stress test result.
     * @param {TestWFRP} test - The test result object.
     */
    async _processStressTest(test) {
        const testOptions = test.data.preData.options;
        const actorId = test.data.context.speaker.actor;
        if (testOptions.stress && actorId) {
            let actor = game.actors.get(actorId);
            if (actor) {
                await this._handleStressResult(actor, test);
            }
        }
    }

    /**
     * Handles the result of a stress test.
     * @param {ActorWfrp4e} actor - The actor who took the test.
     * @param {TestWFRP} test - The test result object.
     */
    async _handleStressResult(actor, test) {
        this._addStressToActor(actor)
        const { outcome, roll, target, SL } = test.result;
        const failed = outcome === "failure";
        let stressGained = 0;
        let newStress = Number(actor.flags.core.stress.value);

        // Determine if the test is a fumble or critical
        const isFumble = failed && this._isFumble(roll, target);
        const isCritical = !failed && this._isCritical(roll, target);

        if (isFumble) {
            this._createStressResultChatMessage("StressFumble", actor.name, "gmroll");
        } else if (isCritical) {
            newStress = 0;
            this._createStressResultChatMessage("StressCritical", actor.name, "gmroll");
        } else if (failed) {
            stressGained = 1 - SL;
            newStress += stressGained;
            this._createStressResultChatMessage("StressFail", actor.name, "gmroll", stressGained);
        } else {
            this._createStressResultChatMessage("StressPass", actor.name, "gmroll");
        }

        // Revert previous test if rerolled
        if (test.context.reroll || test.context.fortuneUsedAddSL) {
            let previousStressGained = test.context.previousResult.stressGained;
            test.result.stressGained = stressGained
            newStress -= previousStressGained;
        } else {
            test.result.stressGained = stressGained
        }

        // Update actor's stress
        await actor.update({ "flags.core.stress.value": newStress });

        // Handle stress affliction
        if (actor.flags.core.stress.max && newStress > actor.flags.core.stress.max) {
            this._createStressResultChatMessage("StressAffliction", actor.name, "gmroll");
        }
    }

    // Helper method to check for fumble
    _isFumble(roll, target) {
        return (roll > target && roll % 11 === 0) || roll === 100 || roll === 99;
    }

    // Helper method to check for critical success
    _isCritical(roll, target) {
        return roll <= target && roll % 11 === 0;
    }

    // Helper method to create chat messages
    _createStressResultChatMessage(messageKey, actorName, rollType, stressGained) {
        let message = game.i18n.format(`CHAT.${messageKey}`, { name: actorName, number: stressGained });
        ChatMessage.create(WFRP_Utility.chatDataSetup(message, rollType, false));
    }

    /**
     * Ensures the actor object has a stress field initialized
     * @param {ActorWfrp4e} actor - The actor to test.
     * @private
     */
    _addStressToActor(actor) {
        const stressPath = "flags.core.stress";
        let stress = getProperty(actor, stressPath);

        // If the stress object doesn't exist, initialize it
        if (!stress) {
            stress = {
                type: "Number",
                label: "Stress",
                value: 0,
                max: 0 // Initial max value which will be updated below
            };
        }

        // If the stress max property doesn't exist or is not set, calculate and update it
        // if (!stress.max) {
            const wpBonus = getProperty(actor, "system.characteristics.wp.bonus") || 0;
            const intBonus = getProperty(actor, "system.characteristics.int.bonus") || 0;
            stress.max = intBonus + wpBonus;
        // }

        // Update the actor with the new or updated stress object
        actor.setFlag('core', 'stress', stress);
    }
}

Hooks.on("setup", () => {
    new StressManager().initialize();
});
