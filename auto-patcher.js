const fs = require('fs');
const path = require('path');

// Target directory (where our custom extension lives)
const destDir = __dirname;

// Script argument: path to the new official Chrome extension version directory
const srcDir = process.argv[2];

if (!srcDir) {
    console.error('Error: Please provide the path to the new official LINE extension directory as an argument.');
    console.error('Example: node auto-patcher.js "C:\\Users\\takeru\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Extensions\\ophjlpahpchlmihnnnihgmmeilfjmjjc\\3.7.3_0"');
    process.exit(1);
}

if (!fs.existsSync(srcDir)) {
    console.error(`Error: Source directory "${srcDir}" does not exist!`);
    process.exit(1);
}

// 1. Copy files from new version, but preserve accessibility-patch.js and auto-patcher.js
function copyDirSync(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (let entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDirSync(srcPath, destPath);
        } else {
            // Do NOT overwrite our patch script or this patcher script
            if (entry.name === 'accessibility-patch.js' || entry.name === 'auto-patcher.js') {
                continue;
            }
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

try {
    console.log(`Step 1: Copying clean files from "${srcDir}" to "${destDir}"...`);
    copyDirSync(srcDir, destDir);
    console.log('Copy complete.');

    // Find JS and CSS files dynamically (names might change slightly in updates)
    const jsDir = path.join(destDir, 'static/js');
    const cssDir = path.join(destDir, 'static/css');

    const mainJsFile = path.join(jsDir, 'main.js');
    const popupJsFile = path.join(jsDir, 'popup.js'); // check if exists

    // CSS file name might change (e.g. main.0e756bd5.css), search for it
    const cssFiles = fs.readdirSync(cssDir).filter(f => f.startsWith('main.') && f.endsWith('.css'));
    if (cssFiles.length === 0) {
        throw new Error('Could not find main.*.css file!');
    }
    const mainCssFile = path.join(cssDir, cssFiles[0]);

    console.log(`Step 2: Patching JS file: ${mainJsFile}...`);
    let jsContent = fs.readFileSync(mainJsFile, 'utf8');

    // JS Patch 1: Reverse message list array rendering
    const targetJsMap = 'e=>e.map(((t,n)=>{var a,i,o,s,l;const[c]=x([t]);if(!c)return null;const[u]=x([null!==(a=e[n-1])&&void 0!==a?a:""]),[d]=x([null!==(i=e[n+1])&&void 0!==i?i:""]),';
    const replacementJsMap = 'e=>[...e].reverse().map(((t,n)=>{var a,i,o,s,l;const[c]=x([t]);if(!c)return null;const[u]=x([null!==(a=e[n+1])&&void 0!==a?a:""]),[d]=x([null!==(i=e[n-1])&&void 0!==i?i:""]),';

    // JS Patch 2: Scroll bottom function K
    const targetJsK = 'K=(0,Tn.useCallback)((()=>{var e;return null===(e=D.current)||void 0===e?void 0:e.scrollTo(0,0)}),[])';
    const replacementJsK = 'K=(0,Tn.useCallback)((()=>{var e;return null===(e=D.current)||void 0===e?void 0:e.scrollTo(0,e.scrollHeight)}),[])';

    // JS Patch 3: Scroll bottom anchor check G
    const targetJsG = 'U(D.current.scrollTop>=-30)';
    const replacementJsG = 'U(D.current.scrollHeight-D.current.clientHeight-D.current.scrollTop<=30)';

    let jsPatched = 0;
    if (jsContent.includes(targetJsMap)) {
        jsContent = jsContent.replace(targetJsMap, replacementJsMap);
        jsPatched++;
    } else {
        console.warn('Warning: Could not patch message list mapping in JS.');
    }

    if (jsContent.includes(targetJsK)) {
        jsContent = jsContent.replace(targetJsK, replacementJsK);
        jsPatched++;
    } else {
        console.warn('Warning: Could not patch scroll function K in JS.');
    }

    if (jsContent.includes(targetJsG)) {
        jsContent = jsContent.replace(targetJsG, replacementJsG);
        jsPatched++;
    } else {
        console.warn('Warning: Could not patch scroll check G in JS.');
    }

    fs.writeFileSync(mainJsFile, jsContent, 'utf8');
    console.log(`JS Patching finished. Applied ${jsPatched}/3 patches.`);

    console.log(`Step 3: Patching CSS file: ${mainCssFile}...`);
    let cssContent = fs.readFileSync(mainCssFile, 'utf8');
    const targetCss = '.chatroomContent-module__content_area__gK6db .message_list{box-sizing:border-box;display:flex;flex-direction:column-reverse;';
    const replacementCss = '.chatroomContent-module__content_area__gK6db .message_list{box-sizing:border-box;display:flex;flex-direction:column;';
    
    if (cssContent.includes(targetCss)) {
        cssContent = cssContent.replace(targetCss, replacementCss);
        fs.writeFileSync(mainCssFile, cssContent, 'utf8');
        console.log('CSS Patching finished.');
    } else {
        console.warn('Warning: Could not patch CSS message_list flex-direction.');
    }

    console.log('Step 4: Inserting patch loader to index.html and popup.html...');
    const indexHtmlFile = path.join(destDir, 'index.html');
    const popupHtmlFile = path.join(destDir, 'popup.html');

    const scriptTag = '<script defer="defer" src="/accessibility-patch.js"></script>';

    // Patch index.html
    let indexHtml = fs.readFileSync(indexHtmlFile, 'utf8');
    if (!indexHtml.includes(scriptTag)) {
        indexHtml = indexHtml.replace('src="/static/js/main.js"></script>', 'src="/static/js/main.js"></script>' + scriptTag);
        fs.writeFileSync(indexHtmlFile, indexHtml, 'utf8');
        console.log('Updated index.html');
    } else {
        console.log('index.html already has patch script loaded.');
    }

    // Patch popup.html
    let popupHtml = fs.readFileSync(popupHtmlFile, 'utf8');
    if (!popupHtml.includes(scriptTag)) {
        popupHtml = popupHtml.replace('src="/static/js/popup.js"></script>', 'src="/static/js/popup.js"></script>' + scriptTag);
        fs.writeFileSync(popupHtmlFile, popupHtml, 'utf8');
        console.log('Updated popup.html');
    } else {
        console.log('popup.html already has patch script loaded.');
    }

    console.log('Step 5: Updating manifest.json metadata...');
    const manifestFile = path.join(destDir, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    
    manifest.name = 'LINE (Accessible)';
    delete manifest.update_url; // Prevent auto updates overwriting this folder
    
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 4), 'utf8');
    console.log('Updated manifest.json.');

    console.log('\nSUCCESS! Standalone Accessible LINE Extension has been updated and patched successfully!');
    console.log('Please reload the extension in Chrome (chrome://extensions/) to apply changes.');

} catch (err) {
    console.error('Fatal Error during auto patching:', err);
}
