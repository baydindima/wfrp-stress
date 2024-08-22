const axios = require('axios');
const fs = require('fs');
const readline = require('readline');
const path = require('path');

const OWNER = 'baydindima';
const REPO = 'wfrp-stress';

// Create a readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askQuestion(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function updateModuleJson(localModuleJsonPath, version) {
    const moduleJson = require(localModuleJsonPath);
    moduleJson.version = version;
    moduleJson.manifest = moduleJson.manifest.replace('${version}', version)
    moduleJson.download = moduleJson.download.replace('${version}', version)
    fs.writeFileSync(localModuleJsonPath, JSON.stringify(moduleJson, null, 2));
    console.log(`Updated module.json to version ${version}`);
}

async function createRelease(version, description) {
    try {
        const response = await axios.post(
            `https://api.github.com/repos/${OWNER}/${REPO}/releases`,
            {
                tag_name: `${version}`,
                name: `${version}`,
                body: description,
                draft: false,
                prerelease: false,
            },
            {
                headers: {
                    'Authorization': `token ${process.env.GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json',
                },
            }
        );

        const uploadUrl = response.data.upload_url; // Extract the upload URL from the response
        console.log('Release created successfully:', response.data);

        // Call the function to publish assets with the uploadUrl and version
        await publishAssets(uploadUrl, version);
    } catch (error) {
        console.error('Error creating release:', error.response ? error.response.data : error.message);
    }
}

async function publishAssets(uploadUrl, version) {
    try {
        const moduleJsonUrl = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${version}/module.json`;
        const localModuleJsonPath = path.join(__dirname, `module-${version}.json`);

        console.log(moduleJsonUrl)
        console.log('Downloading module.json...');
        await downloadFile(moduleJsonUrl, localModuleJsonPath);
        // Update module.json with the new version
        await updateModuleJson(localModuleJsonPath, version);
        console.log('module.json downloaded successfully.');

        // Upload module.json as an asset
        await uploadAsset(uploadUrl, localModuleJsonPath, 'module.json', 'application/json');

        // Download the zip file from GitHub
        const zipFileName = `${REPO}-${version}.zip`;
        const zipFileUrl = `https://github.com/${OWNER}/${REPO}/archive/refs/tags/${version}.zip`;
        await downloadFile(zipFileUrl, zipFileName);

        // Upload the zip file as an asset
        await uploadAsset(uploadUrl, path.join(__dirname, zipFileName), `${REPO}.zip`, 'application/zip');

        console.log('Assets uploaded successfully');
    } catch (error) {
        console.error('Error uploading assets:', error.response ? error.response.data : error.message);
    }
}

async function uploadAsset(uploadUrl, filePath, assetName, contentType) {
    try {
        // Create a readable stream for the file
        const fileStream = fs.createReadStream(filePath);
        const fileData = fs.statSync(filePath);

        // Upload the asset using axios
        const response = await axios.post(
            uploadUrl.replace('{?name,label}', `?name=${encodeURIComponent(assetName)}`),
            fileStream,
            {
                headers: {
                    'User-Agent': 'Release-Agent',
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': contentType,
                    'Content-Length': fileData.size,
                    'Authorization': `token ${process.env.GITHUB_TOKEN}`,
                },
            }
        );

        console.log(`Asset ${assetName} uploaded successfully.`);

        // Delete the file after successful upload
        fs.unlinkSync(filePath);
        console.log(`File ${filePath} deleted successfully.`);

        return response.data;
    } catch (error) {
        throw new Error(`Failed to upload ${assetName}: ${error.message}`);
    }
}

async function downloadFile(url, outputPath) {
    const writer = fs.createWriteStream(outputPath);

    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream',
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

async function main() {
    const version = await askQuestion('Enter the new release version (e.g., 1.0.1): ');
    const description = await askQuestion('Enter the release description: ');


    // Create a release on GitHub
    await createRelease(version, description);

    // Close the readline interface
    rl.close();
}

main();
