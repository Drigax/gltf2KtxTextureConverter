const spawn = require('child_process').spawn;
const exec = require('child_process').exec;
const fs = require('fs');

// command line supplied flags
var gltfKtxCompressor_makeExtensionRequired = false;
var gltfKtxCompressor_useTwoChannelNormals = false;
var gltfKtxCompressor_separateORMTextures = false;
var gltfKtxCompressor_inputFilePath = null;
var gltfKtxCompressor_outputFilePath = null;
var gltfKtxCompressor_scriptLocation = null;

function OnError(err) {
    throw new Error(err);
}

function OnExit (code) {
    if(code != 0) throw new Error(`toktx converter failed with code ${code}. Check console log for details.`);
    console.log(`toKtxExited with code: ${code}`);
}

function runToKtx(args, onError, onExit){
    console.log(`Executing toKtx with arguments: ${args}`);
    const child = spawn('toktx.exe', args);
    child.stdout.on('data', (data) => {
        console.log(data);
    });
    child.stderr.on('data', (data) => {
        console.error(data);
    });
    child.on('error', onError);
    child.on('exit', onExit);
}

function helpDialog(){
    let string = "Usage: gltfKtxBasisUCompressor.js [options] <outfile> <infile>\r\n\
    <outfile>               The destination glTF file.\r\n\
    <infile>                The input glTF file containing .png, .pam, .ppm, .pgm formatted textures\r\n\
    Options are:\r\n\
    --extensionRequired     Adds the KHR_texture_basisu extension to the output glTF\r\n\
                            as extensionsRequired. If not specified, the extension is added as extensionsUsed.\r\n\
    --useTwoChannelNormals  Converts textures used in the scene as normal maps from RGB format to R+Alpha\r\n\
                            normal map format.\r\n\
    --separateORM           Separates the ORM texture from packed RGB texture to multiple textures. O is stored\r\n\
                            in R channel of a separate texture, while R+M maps are stored as packed R+Alpha channels\r\n\
                            in the other texture\r\n\
    \r\n\
    toktx options are propagated as well:\r\n\
    \r\n\
    \r\n\
    "
    console.log(string);

    runToKtx(["-h"], (err) => {
        throw new Error(err);
    }, (code) => {
        process.exit(code);
    });
}

function processCommandLineArgs(args){
    let toKtxArgs = [];
    for (let i = 0; i < args.length; ++i) {
        let arg = args[i];
        if (i === 1) {
            gltfKtxCompressor_scriptLocation = arg.substring(0, str.lastIndexOf("/"));
        }
        if (arg === "--extensionRequired") {
            gltfKtxCompressor_makeExtensionRequired = true;
        } else if (arg === "--useTwoChannelNormals") {
            gltfKtxCompressor_use2ChannelNormals = true;
        } else if (arg === "--separateORM"){
            gltfKtxCompressor_separateORMTextures = true;
        } else if (i == args.length -2) {
            gltfKtxCompressor_outputFilePath = arg;
            toKtxArgs.push(arg);
        } else if (i == args.length -1) {
            gltfKtxCompressor_inputFilePath = arg;
            toKtxArgs.push(arg);
        }else {
            // perhaps we want to filter the arguments to make sure that they're expected from toKtx?
            toKtxArgs.push(arg);
        }
    }
    return toKtxArgs;
}

let toKtxArgs = [];
console.log(process.argv);

if (process.argv.includes("-h") || process.argv.includes("--help")){
    helpDialog();
} else {
    toKtxArgs = processCommandLineArgs(process.argv.slice(2));
    fs.readFile(gltfKtxCompressor_inputFilePath, fs.constants.R_OK, function (err, data) {
        if (err && err.code === 'ENOENT') {
            throw new Error(`Input glTF ${gltfKtxCompressor_inputFilePath} is not found.`);
        } else if (err) {
            throw err;
        }
        var json = JSON.parse(data);
        console.log(`Converting compatible textures in ${gltfKtxCompressor_inputFilePath} to KTX2...`)
        convertGLTFTexturesToKTX(json, gltfKtxCompressor_outputFilePath, toKtxArgs);
    });
}

function convertGLTFTexturesToKTX(json, outputFilePath, toKtxArgs){
    
}