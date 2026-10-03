from PIL import Image

def resize_image(input_path, output_path, size):
    img = Image.open(input_path).convert("RGBA")
    # Resize to exact square
    img = img.resize((size, size), Image.Resampling.LANCZOS)
    img.save(output_path, format="PNG")
    print(f"Resized image to {size}x{size} and saved to {output_path}")

if __name__ == "__main__":
    resize_image("frontend/public/logo-circle.png", "frontend/public/logo-circle.png", 192)
