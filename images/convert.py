from PIL import Image, ExifTags

# Open the image
image = Image.open("input.jpg")

# Fix orientation based on EXIF data
try:
    for orientation in ExifTags.TAGS.keys():
        if ExifTags.TAGS[orientation] == 'Orientation':
            break
    exif = image._getexif()
    if exif is not None and orientation in exif:
        if exif[orientation] == 3:
            image = image.rotate(180, expand=True)
        elif exif[orientation] == 6:
            image = image.rotate(270, expand=True)
        elif exif[orientation] == 8:
            image = image.rotate(90, expand=True)
except (AttributeError, KeyError, IndexError):
    pass  # No EXIF data, no rotation needed

# Save as WebP
image.save("output.webp", "webp", quality=50)
from PIL import Image

# Open the JPG image
image = Image.open("input.jpg")

# Convert to WebP and save
image.save("output.webp", "webp", quality=50)

print("Conversion complete! Saved as output.webp")

