const spawn = require('child_process').spawn;
const execSync = require('child_process').execSync;
const fs = require('fs');
const path = require('path');

// command line supplied flags
var gltfKtxCompressor_makeExtensionRequired = true;
var gltfKtxCompressor_useKtx1 = false;
var gltfKtxCompressor_useTwoChannelNormals = false;
var gltfKtxCompressor_separateORMTextures = false;
var gltfKtxCompressor_keepFallbackTextureImage = false;
var gltfKtxCompressor_inputFilePath = null;
var gltfKtxCompressor_outputFilePath = null;
var gltfKtxCompressor_scriptLocation = null;
var gltfKtxCompressor_processExecutable = null;

let khrTextureBasisU_extensionName = "KHR_texture_basisu";

function OnError(err) {
    throw new Error(err);
}

function OnExit(code) {
    if (code != 0) throw new Error(`toktx converter failed with code ${code}. Check console log for details.`);
    console.log(`toKtxExited with code: ${code}`);
}

function runToKtx(args) {
    if (!gltfKtxCompressor_useKtx1){
        args.unshift("--t2");
    }
    console.log(`Executing toKtx with arguments: ${args}`);
    let command = 'toktx.exe';
    for (let i = 0; i < args.length; ++i) {
        command += " " + args[i];
    }
    const output = execSync(command);
    console.log(output);
}

function helpDialog() {
    let string = "Usage: gltfKtxBasisUCompressor.js [options] <outfile> <infile>\r\n\
    <outfile>               The destination glTF file.\r\n\
    <infile>                The input glTF file containing .png, .pam, .ppm, .pgm formatted textures\r\n\
    Options are:\r\n\
    --extensionOptional     If not specified, the KHR_texture_basisu extension is added to the output glTF\r\n\
                            as extensionsRequired.\r\n\
    --useTwoChannelNormals  Converts textures used in the scene as normal maps from RGB format to R+Alpha\r\n\
                            normal map format.\r\n\
    --separateORM           Separates the ORM texture from packed RGB texture to multiple textures. O is stored\r\n\
                            in R channel of a separate texture, while R+M maps are stored as packed R+Alpha channels\r\n\
                            in the other texture\r\n\
    --keepFallbackTexture   Retains the unconverted textures as a fallback for the output gltf scene. implies --extensionOptional. \r\n\
    --useKtx1               If not specified, the files will be converted to ktx2 format. if specified, the ktx1 format will be used\r\n\
    --verbose (or -v)       Enables verbose logging.\r\n\
    \r\n\
    toktx options are propagated as well:\r\n\
    \r\n\
    \r\n\
    "
    console.log(string);

    runToKtx(["-h"]);
}

function convertReferencedImage(gltf, imageIndex, toKtxArgs) {
    let image = gltf.images[imageIndex];

    let outGltfPath = gltfKtxCompressor_outputFilePath.substring(0, gltfKtxCompressor_outputFilePath.lastIndexOf(path.sep) + 1);
    let outImagePath = image.uri.substring(0, image.uri.lastIndexOf("."));
    outImagePath += ".ktx";
    let outImagePathFull = path.resolve(outGltfPath, outImagePath);
    toKtxArgs.push(outImagePathFull);

    let inGltfPath = gltfKtxCompressor_inputFilePath.substring(0, gltfKtxCompressor_inputFilePath.lastIndexOf(path.sep) + 1);
    let inImagePath = image.uri;
    let inImagePathFull = path.join(inGltfPath, inImagePath);
    toKtxArgs.push(inImagePathFull);
    runToKtx(toKtxArgs);

    if (gltfKtxCompressor_keepFallbackTextureImage) {
        imageIndex = gltf.images.push(Object.assign({}, gltf.images[imageIndex])) - 1;
    }

    gltf.images[imageIndex].uri = outImagePath;
    return imageIndex;
}

function convertGLTFImagesToKTX(gltf, outputFilePath, toKtxArgs) {
    let addKtxExtensionFlag = false;
    if (gltf.images) {
        for (let i = 0; i < gltf.images.length; ++i) {
            let image = gltf.images[i];
            console.log(`processing image ${i} - ${image.uri}`);
            let args = toKtxArgs;
            if (!isDataUrl(image.uri)) {
                let imageType = getImageType(image.uri);
                if (isSupportedImageType(imageType)) {
                    textureIndex = convertReferencedImage(gltf, i, toKtxArgs.slice());
                    addKtxExtensionFlag = true;
                    updateReferencingTextures(gltf, i, textureIndex, gltfKtxCompressor_keepFallbackTextureImage);
                } else {
                    console.error(`Image type ${imageType} is not supported. (${supportedImageTypes}) Skipping image ${i}...`)
                    fs.copyFileSync(path.resolve(gltfKtxCompressor_inputFilePath.substring(0, gltfKtxCompressor_inputFilePath.lastIndexOf(path.sep)), image.uri),
                                    path.resolve(gltfKtxCompressor_outputFilePath.substring(0, gltfKtxCompressor_outputFilePath.lastIndexOf(path.sep)), image.uri));
                }
            } else {
                console.error(`Embedded image files are not supported. Skipping image ${i}...`);
                continue;
            }
        }
    }

    if (addKtxExtensionFlag) {
        addKtxExtensionToGltf(gltf);
    }
}

function updateReferencingTextures(gltf, imageOriginalIndex, convertedImageIndex, useConvertedImageAsFallback){
    for (let i = 0; i < gltf.textures.length; ++i){
        let texture = gltf.textures[i];
        if (texture.source == imageOriginalIndex){
            if (!useConvertedImageAsFallback) {
                delete texture.source;
            }
            if (!texture.extensions){
                texture.extensions = {};
            }
            if (!texture.extensions.KHR_texture_basisu) {
                texture.extensions.KHR_texture_basisu = {};
            }
            texture.extensions.KHR_texture_basisu = { "source": convertedImageIndex };
        }
    }
}

function addKtxExtensionToGltf(gltf) {
    if (gltfKtxCompressor_makeExtensionRequired) {
        if (!gltf.extensionsRequired) {
            gltf.extensionsRequired = [];
        }
        gltf.extensionsRequired.push(khrTextureBasisU_extensionName);
    }
    if (!gltf.extensionsUsed) {
        gltf.extensionsUsed = [];
    }
    gltf.extensionsUsed.push(khrTextureBasisU_extensionName);
}

function isDataUrl(url) {
    return !!url.match(isDataUrl.regex);
}
isDataUrl.regex = /^\s*data:([a-z]+\/[a-z]+(;[a-z\-]+\=[a-z\-]+)?)?(;base64)?,[a-z0-9\!\$\&\'\,\(\)\*\+\,\;\=\-\.\_\~\:\@\/\?\%\s]*\s*$/i;

function getImageType(url) {
    return url.substring(url.lastIndexOf(".") + 1, url.length);
}

function isSupportedImageType(type) {
    return supportedImageTypes.includes(type.toLowerCase());
}
supportedImageTypes = ["pam", "ppm", "pgm", "png"]

function processCommandLineArgs(args) {
    let toKtxArgs = [];
    for (let i = 0; i < args.length; ++i) {
        let arg = args[i];
        if (i === 0) {
            gltfKtxCompressor_processExecutable = arg;
        } else if (i === 1) {
            gltfKtxCompressor_scriptLocation = arg.substring(0, arg.lastIndexOf("/"));
        } else if (arg === "-v" || arg === "--verbose") {
            gltfKtxCompressor_verbose = true;
        } else if (arg === "--extensionOptional") {
            gltfKtxCompressor_makeExtensionRequired = false;
        } else if (arg === "--useTwoChannelNormals") {
            gltfKtxCompressor_use2ChannelNormals = true;
        } else if (arg === "--useKTX1") {
            gltfKtxCompressor_useKtx1 = true;
        } else if (arg === "--separateORM") {
            gltfKtxCompressor_separateORMTextures = true;
        } else if (arg === "--keepFallbackTexture") {
            gltfKtxCompressor_keepFallbackTextureImage = true;
            gltfKtxCompressor_makeExtensionRequired = false;
        }else if (i == args.length - 2) {
            gltfKtxCompressor_outputFilePath = arg;
        } else if (i == args.length - 1) {
            gltfKtxCompressor_inputFilePath = arg;
        } else {
            // perhaps we want to filter the arguments to make sure that they're expected from toKtx?
            toKtxArgs.push(arg);
        }
    }
    return toKtxArgs;
}

function copyGltfBuffers(gltf, gltfKtxCompressor_inputFilePath, gltfKtxCompressor_outputFilePath) {
    if (gltf.buffers){
        for (let i = 0; i < gltf.buffers.length; ++i) {
            let buffer = gltf.buffers[i];
            if (!isDataUrl(buffer.uri)){
                fs.copyFileSync(path.resolve(gltfKtxCompressor_inputFilePath.substring(0, gltfKtxCompressor_inputFilePath.lastIndexOf(path.sep)), buffer.uri),
                                path.resolve(gltfKtxCompressor_outputFilePath.substring(0, gltfKtxCompressor_outputFilePath.lastIndexOf(path.sep)), buffer.uri));
            }
        }
    }
    
}

let toKtxArgs = [];

if (process.argv.includes("-h") || process.argv.includes("--help")) {
    helpDialog();
} else {
    toKtxArgs = processCommandLineArgs(process.argv);
    fs.readFile(gltfKtxCompressor_inputFilePath, function (err, data) {
        if (err && err.code === 'ENOENT') {
            throw new Error(`Input glTF ${gltfKtxCompressor_inputFilePath} is not found.`);
        } else if (err) {
            throw err;
        }
        var gltf = JSON.parse(data);
        console.log(`Converting compatible textures in ${gltfKtxCompressor_inputFilePath} to KTX2...`)
        convertGLTFImagesToKTX(gltf, gltfKtxCompressor_outputFilePath, toKtxArgs);
        var convertedGltf = JSON.stringify(gltf);
        fs.writeFile(gltfKtxCompressor_outputFilePath, convertedGltf, (err) => {
            if (err) throw err;
            copyGltfBuffers(gltf, gltfKtxCompressor_inputFilePath, gltfKtxCompressor_outputFilePath);
            console.log("Conversion complete!");
        });
    });
}