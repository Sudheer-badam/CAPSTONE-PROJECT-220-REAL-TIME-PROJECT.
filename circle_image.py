from PIL import Image, ImageDraw, ImageOps
import sys
import os

def crop_to_circle(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    
    # Calculate the size for a square crop
    min_dim = min(img.size)
    
    # Crop to a square first (centered)
    left = (img.width - min_dim) / 2
    top = (img.height - min_dim) / 2
    right = (img.width + min_dim) / 2
    bottom = (img.height + min_dim) / 2
    
    img_square = img.crop((left, top, right, bottom))
    
    # Create a circular mask
    mask = Image.new('L', img_square.size, 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, img_square.size[0], img_square.size[1]), fill=255)
    
    # Apply the mask
    result = Image.new('RGBA', img_square.size, (0, 0, 0, 0))
    result.paste(img_square, (0, 0), mask=mask)
    
    result.save(output_path, format="PNG")
    print(f"Saved circular image to {output_path}")

if __name__ == "__main__":
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    crop_to_circle(input_file, output_file)
