// Script to center images around the player
// Analyzes images to find the player and centers/crops around them
// Run with: node center_player_images.js

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const INPUT_DIR = path.join(__dirname, '2025 Pics');
const OUTPUT_DIR = path.join(__dirname, '2025 Pics', 'centered');
const REFERENCE_IMAGE = path.join(__dirname, '2024.jpg');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log('Created output directory:', OUTPUT_DIR);
}

// Analyze reference image to get target dimensions and aspect ratio
async function analyzeReference() {
  try {
    const metadata = await sharp(REFERENCE_IMAGE).metadata();
    console.log('Reference image:', {
      width: metadata.width,
      height: metadata.height,
      aspectRatio: (metadata.width / metadata.height).toFixed(2)
    });
    return {
      width: metadata.width,
      height: metadata.height,
      aspectRatio: metadata.width / metadata.height
    };
  } catch (error) {
    console.error('Error reading reference image:', error.message);
    // Default to a reasonable aspect ratio if reference can't be read
    return { width: 1000, height: 1500, aspectRatio: 1000 / 1500 };
  }
}

// Detect the main subject (player) in the image using multiple techniques
async function detectPlayerCenter(imagePath) {
  try {
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    
    // Resize for faster processing (process at lower resolution)
    const processWidth = 800;
    const processHeight = Math.round(processWidth * (metadata.height / metadata.width));
    const scaleX = metadata.width / processWidth;
    const scaleY = metadata.height / processHeight;
    
    // Get image data at lower resolution for analysis
    const { data, info } = await image
      .resize(processWidth, processHeight, { fit: 'inside' })
      .greyscale()
      .normalise()
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const width = info.width;
    const height = info.height;
    
    // Method 1: Find center of mass of darker regions (player is typically darker)
    let totalMass = 0;
    let weightedX = 0;
    let weightedY = 0;
    
    // Calculate histogram to find optimal threshold
    const histogram = new Array(256).fill(0);
    for (let i = 0; i < data.length; i++) {
      histogram[data[i]]++;
    }
    
    // Find median value for threshold
    let cumulative = 0;
    let median = 128;
    const target = (width * height) / 2;
    for (let i = 0; i < 256; i++) {
      cumulative += histogram[i];
      if (cumulative >= target) {
        median = i;
        break;
      }
    }
    
    // Use pixels darker than median (likely the player)
    const threshold = Math.max(50, median - 30);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const pixelValue = data[idx];
        
        // Weight darker pixels more (player is typically darker than background)
        const weight = 255 - pixelValue;
        
        if (pixelValue < threshold && weight > 100) {
          totalMass += weight;
          weightedX += x * weight;
          weightedY += y * weight;
        }
      }
    }
    
    let centerX, centerY;
    
    if (totalMass > 0) {
      centerX = (weightedX / totalMass) * scaleX;
      centerY = (weightedY / totalMass) * scaleY;
    } else {
      // Fallback: use center of image
      centerX = metadata.width / 2;
      centerY = metadata.height / 2;
    }
    
    // Adjust Y position - players are typically in lower 2/3 of image
    // This helps center on the body, not just the top
    const adjustedY = Math.min(
      centerY * 1.1, // Slight downward adjustment
      metadata.height * 0.7 // But not too low
    );
    
    return { 
      x: Math.max(0, Math.min(metadata.width, centerX)), 
      y: Math.max(0, Math.min(metadata.height, adjustedY))
    };
  } catch (error) {
    console.error(`Error detecting player in ${imagePath}:`, error.message);
    // Fallback to center
    const metadata = await sharp(imagePath).metadata();
    return { x: metadata.width / 2, y: metadata.height * 0.6 }; // Slightly lower than center
  }
}

// Smart crop: center around the player while maintaining aspect ratio
async function centerAndCropImage(inputPath, outputPath, targetAspectRatio, playerCenter, reference) {
  try {
    const image = sharp(inputPath);
    const metadata = await image.metadata();
    
    const originalWidth = metadata.width;
    const originalHeight = metadata.height;
    const originalAspectRatio = originalWidth / originalHeight;
    
    let cropWidth, cropHeight, left, top;
    
    // Calculate crop dimensions to match target aspect ratio
    if (originalAspectRatio > targetAspectRatio) {
      // Image is wider than target - crop width
      cropHeight = originalHeight;
      cropWidth = Math.round(cropHeight * targetAspectRatio);
    } else {
      // Image is taller than target - crop height
      cropWidth = originalWidth;
      cropHeight = Math.round(cropWidth / targetAspectRatio);
    }
    
    // Ensure crop doesn't exceed image bounds
    cropWidth = Math.min(cropWidth, originalWidth);
    cropHeight = Math.min(cropHeight, originalHeight);
    
    // Center the crop around the detected player position
    left = Math.max(0, Math.min(
      originalWidth - cropWidth,
      Math.round(playerCenter.x - cropWidth / 2)
    ));
    
    top = Math.max(0, Math.min(
      originalHeight - cropHeight,
      Math.round(playerCenter.y - cropHeight / 2)
    ));
    
    // Ensure we don't go out of bounds
    if (left + cropWidth > originalWidth) {
      left = originalWidth - cropWidth;
    }
    if (top + cropHeight > originalHeight) {
      top = originalHeight - cropHeight;
    }
    
    // Crop and resize to match reference dimensions (maintain aspect ratio)
    await image
      .extract({
        left: Math.max(0, left),
        top: Math.max(0, top),
        width: cropWidth,
        height: cropHeight
      })
      .resize(reference.width, reference.height, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 95, mozjpeg: true })
      .toFile(outputPath);
    
    return { success: true, crop: { left, top, width: cropWidth, height: cropHeight } };
  } catch (error) {
    console.error(`Error processing ${inputPath}:`, error.message);
    return { success: false, error: error.message };
  }
}

// Process all images
async function processImages() {
  console.log('🎯 Starting image centering process...\n');
  
  // Analyze reference image
  console.log('📐 Analyzing reference image...');
  const reference = await analyzeReference();
  console.log(`   Target aspect ratio: ${reference.aspectRatio.toFixed(2)}\n`);
  
  // Get all image files
  const files = fs.readdirSync(INPUT_DIR)
    .filter(file => /\.(jpg|jpeg|png)$/i.test(file))
    .filter(file => file !== '2024.jpg'); // Exclude reference image if it's in the same dir
  
  console.log(`📸 Found ${files.length} images to process\n`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const inputPath = path.join(INPUT_DIR, file);
    const outputPath = path.join(OUTPUT_DIR, file.replace(/\.(jpg|jpeg)$/i, '.jpg'));
    
    try {
      console.log(`[${i + 1}/${files.length}] Processing: ${file}`);
      
      // Detect player center
      const playerCenter = await detectPlayerCenter(inputPath);
      console.log(`   Player detected at: (${Math.round(playerCenter.x)}, ${Math.round(playerCenter.y)})`);
      
      // Center and crop
      const result = await centerAndCropImage(inputPath, outputPath, reference.aspectRatio, playerCenter, reference);
      
      if (result.success) {
        console.log(`   ✓ Saved to: ${path.basename(outputPath)}`);
        successCount++;
      } else {
        console.log(`   ✗ Error: ${result.error}`);
        errorCount++;
      }
    } catch (error) {
      console.error(`   ✗ Failed: ${error.message}`);
      errorCount++;
    }
    
    console.log(''); // Empty line for readability
  }
  
  console.log('✅ Processing complete!');
  console.log(`   Success: ${successCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log(`\n📁 Output directory: ${OUTPUT_DIR}`);
}

// Run the script
processImages().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

