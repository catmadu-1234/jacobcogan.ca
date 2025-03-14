from PIL import Image

# Open the image
image = Image.open("input.webp")  # Change to your file name

# Rotate 90 degrees clockwise
rotated_image = image.rotate(-90, expand=True)

# Save the rotated image
rotated_image.save("rotated_output.webp")

print("Image rotated 90 degrees clockwise and saved as 'rotated_output.webp'")
