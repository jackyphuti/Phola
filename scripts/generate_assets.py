#!/usr/bin/env python3
"""
Phola Asset Pipeline Generator
Generates pixel-perfect icons, splash screens, and favicons for:
- iOS (Assets.xcassets universal app icon & 2732x2732 splash)
- Android (Adaptive & standard mipmap-mdpi through xxxhdpi)
- Web PWA (Manifest icons, Apple touch icons, and favicons)
"""

import os
import subprocess
import sys
from pathlib import Path
from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent
SVG_PATH = REPO_ROOT / "public" / "phola-icon.svg"
IOS_ICON_PATH = REPO_ROOT / "ios" / "App" / "App" / "Assets.xcassets" / "AppIcon.appiconset" / "AppIcon-512@2x.png"
IOS_SPLASH_DIR = REPO_ROOT / "ios" / "App" / "App" / "Assets.xcassets" / "Splash.imageset"
ANDROID_RES_DIR = REPO_ROOT / "android" / "app" / "src" / "main" / "res"
PUBLIC_DIR = REPO_ROOT / "public"

ANDROID_DENSITIES = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}

ANDROID_FOREGROUND_DENSITIES = {
    "mipmap-mdpi": 108,
    "mipmap-hdpi": 162,
    "mipmap-xhdpi": 216,
    "mipmap-xxhdpi": 324,
    "mipmap-xxxhdpi": 432,
}

PWA_SIZES = {
    "phola-icon-192x192.png": 192,
    "phola-icon-512x512.png": 512,
    "phola_app_icon-192x192.png": 192,
    "phola_app_icon-512x512.png": 512,
    "apple-icon.png": 180,
    "icon-light-32x32.png": 32,
    "icon-dark-32x32.png": 32,
}


def render_svg_to_png(svg_path: Path, output_png: Path, size: int = 1024, square_bg: bool = True) -> bool:
    """Renders SVG to PNG using ImageMagick."""
    temp_svg = svg_path
    if square_bg:
        # For iOS/Android full-bleed icons, replace rounded corners rx="224" with rx="0"
        svg_content = svg_path.read_text(encoding="utf-8")
        modified_svg = svg_content.replace('rx="224"', 'rx="0"')
        temp_svg = Path("/tmp/phola_square_icon.svg")
        temp_svg.write_text(modified_svg, encoding="utf-8")

    cmd = [
        "magick",
        "-density", "150",
        "-background", "none",
        str(temp_svg),
        "-resize", f"{size}x{size}",
        str(output_png),
    ]

    try:
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def generate_round_icon(image: Image.Image) -> Image.Image:
    """Applies a circular mask to generate Android round launcher icons."""
    from PIL import ImageDraw
    mask = Image.new("L", image.size, 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, image.size[0], image.size[1]), fill=255)
    rounded = Image.new("RGBA", image.size, (0, 0, 0, 0))
    rounded.paste(image, (0, 0), mask=mask)
    return rounded


def generate_all_assets() -> None:
    print(f"📦 [1/4] Rendering master vector: {SVG_PATH.name}...")
    temp_master = Path("/tmp/phola_master_1024.png")

    if not render_svg_to_png(SVG_PATH, temp_master, size=1024, square_bg=True):
        print("❌ Error: ImageMagick (magick) is required to render SVG.")
        sys.exit(1)

    master_img = Image.open(temp_master).convert("RGB")

    # 1. iOS App Icon (1024x1024, RGB no alpha)
    print("🍎 [2/4] Generating iOS assets...")
    IOS_ICON_PATH.parent.mkdir(parents=True, exist_ok=True)
    master_img.save(IOS_ICON_PATH, "PNG")
    print(f"  ✓ iOS AppIcon: {IOS_ICON_PATH.relative_to(REPO_ROOT)}")

    # iOS Splash Screens (2732x2732)
    IOS_SPLASH_DIR.mkdir(parents=True, exist_ok=True)
    splash = Image.new("RGB", (2732, 2732), (8, 79, 79))
    offset = ((2732 - 1024) // 2, (2732 - 1024) // 2)
    splash.paste(master_img, offset)
    for splash_name in ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]:
        splash.save(IOS_SPLASH_DIR / splash_name, "PNG")
        print(f"  ✓ iOS Splash: {splash_name}")

    # 2. Android Mipmap Icons (Standard + Adaptive 108dp Safe-Zone Foregrounds)
    print("🤖 [3/4] Generating Android mipmap launcher & adaptive foreground icons...")
    from PIL import ImageDraw, ImageFilter

    def make_gradient_bg(size: int) -> Image.Image:
        img = Image.new("RGBA", (size, size))
        px = img.load()
        denom = max(1, 2 * (size - 1))
        for y in range(size):
            for x in range(size):
                t = (x + y) / denom
                r = int(round(13 + (8 - 13) * t))
                g = int(round(110 + (79 - 110) * t))
                b = int(round(110 + (79 - 110) * t))
                px[x, y] = (r, g, b, 255)
        return img

    def make_feathered_mask(size: int, border: int) -> Image.Image:
        mask = Image.new("L", (size, size), 0)
        draw = ImageDraw.Draw(mask)
        draw.rectangle((border, border, size - border, size - border), fill=255)
        return mask.filter(ImageFilter.GaussianBlur(radius=max(2, border // 2)))

    for folder, dim in ANDROID_DENSITIES.items():
        out_dir = ANDROID_RES_DIR / folder
        out_dir.mkdir(parents=True, exist_ok=True)

        bg_l = make_gradient_bg(dim)
        inner_l = int(dim * 0.88)
        art_l = master_img.convert("RGBA").resize((inner_l, inner_l), Image.Resampling.LANCZOS)
        mask_l = make_feathered_mask(inner_l, max(2, int(inner_l * 0.08)))
        offset_l = (dim - inner_l) // 2
        bg_l.paste(art_l, (offset_l, offset_l), mask=mask_l)
        bg_l.convert("RGB").save(out_dir / "ic_launcher.png", "PNG")

        round_icon = generate_round_icon(bg_l)
        round_icon.save(out_dir / "ic_launcher_round.png", "PNG")

        f_dim = ANDROID_FOREGROUND_DENSITIES[folder]
        bg_f = make_gradient_bg(f_dim)
        inner_f = int(f_dim * 0.66)
        art_f = master_img.convert("RGBA").resize((inner_f, inner_f), Image.Resampling.LANCZOS)
        mask_f = make_feathered_mask(inner_f, max(3, int(inner_f * 0.08)))
        offset_f = (f_dim - inner_f) // 2
        bg_f.paste(art_f, (offset_f, offset_f), mask=mask_f)
        bg_f.save(out_dir / "ic_launcher_foreground.png", "PNG")
        print(f"  ✓ {folder} (legacy={dim}x{dim}px, adaptive_fg={f_dim}x{f_dim}px)")

    # 3. Web & PWA Assets
    print("🌐 [4/4] Generating Web & PWA icons...")
    for filename, dim in PWA_SIZES.items():
        out_file = PUBLIC_DIR / filename
        resized = master_img.resize((dim, dim), Image.Resampling.LANCZOS)
        resized.save(out_file, "PNG")
        print(f"  ✓ {filename} ({dim}x{dim}px)")

    print("\n✅ All cross-platform icons & assets generated successfully!")


if __name__ == "__main__":
    generate_all_assets()
