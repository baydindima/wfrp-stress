# WFRP Stress Mechanic Module for Foundry VTT

## Overview

This Foundry VTT module adds a custom stress mechanic to the Warhammer Fantasy Roleplay (WFRP) game system, heavily inspired by the work of Andy Law. The module is verified to work with Foundry VTT version 11.

**Manifest URL**:
https://github.com/baydindima/wfrp-stress/releases/latest/download/module.json

## Features

- **Stress Mechanic**: Adds a new stress mechanic to the game, allowing characters to experience varying levels of stress based on in-game events. This mechanic is an implementation inspired by [Andy Law's design](https://www.patreon.com/posts/81988167).

- **Character Sheet Integration**: A new field is added to the character sheet to track a character's stress level.

- **Chat Commands**: Introduces chat commands. The command syntax is as follows:
  
```/stress ${stressLevel}```

Where `stressLevel` can be one of the following:
- `minor`
- `moderate`
- `major`


**Localization**: The module includes a Russian translation, making it accessible to a broader range of players.

## Installation

1. In Foundry VTT, navigate to the **Add-on Modules** section under **Configuration and Setup**.
2. Click on the **Install Module** button.
3. In the **Manifest URL** field, paste the following URL:
   https://github.com/baydindima/wfrp-stress/releases/latest/download/module.json

## Usage

Once the module is installed and activated, the new stress mechanic will be available for all characters in the game. Use the `/stress` chat command to apply stress to a character based on the severity of the situation.

For example:
/stress minor

This command will apply a minor level of stress to the selected character.

## Contributing

Contributions are welcome! If you have suggestions for improvements or new features, feel free to open an issue or submit a pull request.

## License

This project is licensed under the MIT License.

---

*This module is a fan-made extension for the Warhammer Fantasy Roleplay (WFRP) system on Foundry VTT and is not affiliated with or endorsed by the original creators.*
