const fs = require("fs");
const path = require("path");

// Function to copy a file
function copyFile(source, targetDir) {
  // Create the target directory if it doesn't exist
  fs.mkdir(targetDir, { recursive: true }, (err) => {
    if (err) {
      return console.error(`Failed to create directory: ${err.message}`);
    }

    // Define the target file path
    const targetFile = path.join(targetDir, path.basename(source));

    // Copy the file
    fs.copyFile(source, targetFile, (err) => {
      if (err) {
        return console.error(`Failed to copy file: ${err.message}`);
      }
      console.log(`File copied to ${targetFile}`);
    });
  });
}

copyFile("./tree-sitter-opengoal.wasm", "./dist/");
copyFile("./node_modules/web-tree-sitter/tree-sitter.wasm", "./dist/");
