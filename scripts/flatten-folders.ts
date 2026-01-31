import * as fs from 'fs';
import * as path from 'path';

// Configure which folders to flatten (move contents up one level)
const FOLDERS_TO_FLATTEN = [
  'C:/Users/bradleyroepke/ortho-library/Articles/Foot and Ankle/Foot-Ankle',
  'C:/Users/bradleyroepke/ortho-library/Articles/Hand/Out patient hand surgery',
  'C:/Users/bradleyroepke/ortho-library/Articles/Hip and Knee Reconstruction/Recon',
  'C:/Users/bradleyroepke/ortho-library/Articles/Pediatrics/Pediatrics',
  'C:/Users/bradleyroepke/ortho-library/Articles/Trauma/Femur',
  'C:/Users/bradleyroepke/ortho-library/Articles/Trauma/Humerus',
  'C:/Users/bradleyroepke/ortho-library/Articles/Trauma/Tibia',
];

// Or specify a parent folder and it will flatten all immediate subfolders
const PARENT_FOLDERS_TO_PROCESS = [
  // Already processed
];

function flattenFolder(parentFolder: string, subfolder: string): number {
  const subfolderPath = path.join(parentFolder, subfolder);
  const stats = fs.statSync(subfolderPath);

  if (!stats.isDirectory()) return 0;

  const files = fs.readdirSync(subfolderPath);
  let movedCount = 0;

  for (const file of files) {
    const sourcePath = path.join(subfolderPath, file);
    const sourceStats = fs.statSync(sourcePath);

    if (sourceStats.isFile()) {
      let destPath = path.join(parentFolder, file);

      // Handle duplicates by adding a suffix
      if (fs.existsSync(destPath)) {
        const ext = path.extname(file);
        const base = path.basename(file, ext);
        let counter = 1;
        while (fs.existsSync(destPath)) {
          destPath = path.join(parentFolder, `${base}_${counter}${ext}`);
          counter++;
        }
        console.log(`  Renamed to avoid duplicate: ${file} -> ${path.basename(destPath)}`);
      }

      fs.renameSync(sourcePath, destPath);
      movedCount++;
    } else if (sourceStats.isDirectory()) {
      // Recursively flatten nested subfolders
      movedCount += flattenFolder(subfolderPath, file);
    }
  }

  // Remove empty subfolder
  const remaining = fs.readdirSync(subfolderPath);
  if (remaining.length === 0) {
    fs.rmdirSync(subfolderPath);
    console.log(`  Removed empty folder: ${subfolder}`);
  }

  return movedCount;
}

function processParentFolder(parentFolder: string) {
  console.log(`\nProcessing: ${parentFolder}`);

  if (!fs.existsSync(parentFolder)) {
    console.log(`  ERROR: Folder does not exist`);
    return;
  }

  const items = fs.readdirSync(parentFolder);
  let totalMoved = 0;

  for (const item of items) {
    const itemPath = path.join(parentFolder, item);
    const stats = fs.statSync(itemPath);

    if (stats.isDirectory()) {
      console.log(`  Flattening subfolder: ${item}`);
      const moved = flattenFolder(parentFolder, item);
      totalMoved += moved;
      if (moved > 0) {
        console.log(`    Moved ${moved} files`);
      }
    }
  }

  console.log(`  Total files moved: ${totalMoved}`);
}

// Main execution
console.log('=== Folder Flattening Script ===\n');

if (FOLDERS_TO_FLATTEN.length === 0 && PARENT_FOLDERS_TO_PROCESS.length === 0) {
  console.log('No folders configured. Edit this script to add folders to process.');
  console.log('\nExample usage:');
  console.log('  PARENT_FOLDERS_TO_PROCESS = [');
  console.log("    'C:/Users/bradleyroepke/ortho-library/Articles/Shoulder_and_Elbow'");
  console.log('  ]');
  console.log('\nThis will move all files from subfolders up into Shoulder_and_Elbow.');
  process.exit(0);
}

// Process specific subfolders
for (const folder of FOLDERS_TO_FLATTEN) {
  const parent = path.dirname(folder);
  const subfolder = path.basename(folder);
  console.log(`Flattening: ${folder}`);
  const moved = flattenFolder(parent, subfolder);
  console.log(`  Moved ${moved} files`);
}

// Process parent folders (flatten all their subfolders)
for (const parentFolder of PARENT_FOLDERS_TO_PROCESS) {
  processParentFolder(parentFolder);
}

console.log('\n=== Done ===');
