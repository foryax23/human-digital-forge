#!/usr/bin/env bash
# Rebuilds every Vortex brand media file in /public from the owner's asset folder.
#
#   scripts/brand/build-media.sh [path/to/VortexHub/Assets]
#   ONLY=logos scripts/brand/build-media.sh      # groups: logos,icons,intro,signoff,swirl,ascii,films,stills,verify
#   ONLY=verify scripts/brand/build-media.sh     # checks only (a few seconds, no source folder needed)
#
# The asset folder can also come from BRAND_SRC; it defaults to
# ~/Desktop/Assigments/Dandea Mihai/VortexHub/Assets. The promo films (group "films") come from
# FILMS_SRC, by default ~/Desktop/VortexHub-videos (the v03 masters, without the small sample
# labels), else from FILMS_ALT, by default ~/Desktop/Assigments/Dandea Mihai/VortexHub/Vids
# (VortexPromo1.mp4, VortexPromo2.mp4: the v01 copies, which still carry those labels). Their
# sound (music and sound effects) comes from FILMS_AUDIO, by default
# ~/Desktop/VortexHub-videos/out-audio/mixes: the -18 LUFS mixes that
# ~/Desktop/VortexHub-videos/audio-src/mix.sh makes ({scan,deep}_mix_novo_-18LUFS.wav). Set
# FILMS_MIX=vo to take {scan,deep}_mix_vo_-18LUFS.wav (with the owner's voice-over) instead.
#
# Needs ffmpeg (libx264 + libvpx-vp9, libaom-av1 for the film posters), cwebp and python3 with
# Pillow and numpy.
# Outputs (see src/components/landing/media.ts for how the site refers to them):
#   public/media/brand/            logos (WebP + PNG), swirl icon, app icon, favicon-32, cover-art.jpg
#   public/media/brand/intro/      assemble-{1080,720}.mp4, assemble.webm, assemble-poster.jpg,
#                                  assemble-alt-720.{mp4,webm}, assemble-alt-poster.jpg
#   public/media/brand/signoff/    logo-reveal-{1080,720}.mp4, logo-reveal.webm, logo-reveal-poster.jpg,
#                                  logo-reveal-portrait-720.{mp4,webm}, logo-reveal-portrait-poster.jpg
#   public/media/swirl-loop/       master.m3u8, 540p/, 1080p/ (HLS, 4 s segments), poster.jpg, swirl-720.mp4
#                                  swirl-ascii-540.mp4 (group "ascii": the clip the hero's ASCII vortex
#                                  samples, a 10 s half-speed loop that keeps every master frame)
#   public/media/promo/            {scan,deep}-film-720.mp4, {scan,deep}-film-poster.{avif,webp}
#                                  (group "films": the two Romanian promo films, with music and
#                                  sound effects; the page plays them muted until a visitor turns
#                                  the sound on)
#   public/favicon.png, public/apple-touch-icon.png, public/og-image.jpg
#
# Conventions for every video: muted (no audio track; the promo films are the one exception, with
# one AAC track), H.264 High + yuv420p + faststart, VP9 WebM
# as the first <source>, BT.709 limited range tags. The sources are rendered on pure black and the
# site drops that black with `mix-blend-mode: screen`, so the encodes must keep black at Y=16
# (RGB 0); the "verify" step at the end checks it, the swirl loop seam, every file size and the
# logo sizes stated in media.ts. (On the page, `screen` only reaches what is behind the video if
# no ancestor between them creates a stacking context: z-index, opacity, transform, mask.)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SRC="${1:-${BRAND_SRC:-$HOME/Desktop/Assigments/Dandea Mihai/VortexHub/Assets}}"
ANIM="$SRC/Animations"
PUB="$ROOT/public"
BRAND="$PUB/media/brand"
INTRO="$BRAND/intro"
SIGNOFF="$BRAND/signoff"
SWIRL="$PUB/media/swirl-loop"
ONLY="${ONLY:-all}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Owner's logo files (ChatGPT exports; several are byte-identical duplicates, see notes per line).
IMG="$SRC/ChatGPT Image Aug 17, 2026,"
LOGO_PRIMARY="$IMG 04_58_17 PM.png"   # purple metallic wordmark 2073x758 (cleanest edges: no clipped tips)
LOGO_CHROME="$IMG 05_29_19 PM (2).png" # chrome / silver wordmark 1672x941
LOGO_LAVENDER="$IMG 05_32_58 PM.png"   # lavender wordmark 1536x1024 (alpha tops out at 252 by design)
SWIRL_MARK="$IMG 05_25_17 PM.png"      # transparent swirl mark 1254x1254 (= 08_14_37 PM.png)
APP_ICON="$IMG 05_34_29 PM.png"        # opaque rounded app icon 1254x1254 (black outside the corners)
# Unused: 05_28_58 (1) = 05_29_19 (1) glossy purple (V and X tips touch the canvas edge),
#         05_28_59 (3) = 05_29_20 (3) flat purple.

V_INTRO="$ANIM/vortexhub_assemble_6s_hold_1080p_16x9.mp4"   # 1920x1080, 24 fps, 145 frames
V_ALT="$ANIM/vortexhub_assemble_5s_1080p_16x9_altB.mp4"      # 1920x1080, 24 fps, 121 frames
V_LOGO="$ANIM/vortexhub_logo_5s_1080p_16x9.mp4"              # 1920x1080, 24 fps, 121 frames
V_LOGO_P="$ANIM/vortexhub_logo_5s_1080p_9x16.mp4"            # 1080x1920, 24 fps, 121 frames
V_SWIRL="$ANIM/vortexhub_swirl_spin_5s_1080_loop.mp4"        # 1080x1080, 60 fps, 300 frames, seamless

want() { [[ "$ONLY" == "all" || ",$ONLY," == *",$1,"* ]]; }
log() { printf '\n== %s\n' "$*"; }

mkdir -p "$BRAND" "$INTRO" "$SIGNOFF" "$SWIRL/540p" "$SWIRL/1080p"
export SRC BRAND PUB TMP LOGO_PRIMARY LOGO_CHROME LOGO_LAVENDER SWIRL_MARK APP_ICON

# --------------------------------------------------------------------------------------------
# Shared Python helpers: alpha clean-up, trim, premultiplied resize, WebP via cwebp.
# --------------------------------------------------------------------------------------------
cat >"$TMP/brandlib.py" <<'PY'
import os, subprocess
import numpy as np
from PIL import Image

BRAND = os.environ["BRAND"]
NIGHT = (0, 2, 15)  # #00020f, the site's night background


def load_clean(path, floor=12):
    """RGBA with the ChatGPT export's faint matte noise (alpha < floor) removed.

    Alpha is remapped linearly from [floor, 255] to [0, 255], which drops the
    speckles left by the background removal without hardening real soft edges.
    Fully transparent pixels get RGB 0 so they compress to nothing.
    """
    a = np.asarray(Image.open(path).convert("RGBA")).copy()
    al = a[..., 3].astype(np.float32)
    a[..., 3] = np.round(np.clip((al - floor) * 255.0 / (255.0 - floor), 0, 255)).astype(np.uint8)
    a[a[..., 3] == 0, :3] = 0
    return Image.fromarray(a)


def content_box(im, thr=16):
    return im.getchannel("A").point(lambda v: 255 if v > thr else 0).getbbox()


def resize(im, size):
    """Lanczos resize in premultiplied alpha, so edges never pick up dark fringes."""
    return im.convert("RGBa").resize(size, Image.LANCZOS).convert("RGBA")


def place(content, canvas, at):
    out = Image.new("RGBA", canvas, (0, 0, 0, 0))
    out.alpha_composite(content, at)
    return out


def logo(im, *, width=None, height=None, margin):
    """Trim to the artwork and scale to a fixed width or height plus a margin on every side."""
    im = im.crop(content_box(im))
    cw, ch = im.size
    if width:
        w = width - 2 * margin
        h = round(ch * w / cw)
    else:
        h = height - 2 * margin
        w = round(cw * h / ch)
    return place(resize(im, (w, h)), (w + 2 * margin, h + 2 * margin), (margin, margin))


def save_png(im, path):
    im.save(path, optimize=True)
    print(f"  {os.path.relpath(path, os.environ['PUB'])}  {im.size[0]}x{im.size[1]}")


def save_webp(png_path, q=90):
    webp = os.path.splitext(png_path)[0] + ".webp"
    subprocess.run(
        ["cwebp", "-quiet", "-q", str(q), "-alpha_q", "100", "-m", "6", "-sharp_yuv", png_path, "-o", webp],
        check=True,
    )
    print(f"  {os.path.relpath(webp, os.environ['PUB'])}")


def on_night(im):
    bg = Image.new("RGBA", im.size, NIGHT + (255,))
    bg.alpha_composite(im)
    return bg.convert("RGB")
PY
export PYTHONPATH="$TMP"

# --------------------------------------------------------------------------------------------
# 1. Logos: trim the transparent padding, keep a small margin, export PNG + WebP (q 90, alpha).
# --------------------------------------------------------------------------------------------
if want logos; then
  log "logos"
  python3 - <<'PY'
import os
from brandlib import BRAND, load_clean, logo, save_png, save_webp

primary = load_clean(os.environ["LOGO_PRIMARY"])
jobs = [
    # name, source, kwargs
    ("logo-wordmark", primary, dict(width=1200, margin=8)),
    ("logo-wordmark-nav", primary, dict(height=96, margin=3)),  # nav shows it 32-40 px tall
    ("logo-wordmark-chrome", load_clean(os.environ["LOGO_CHROME"]), dict(width=1200, margin=8)),
    ("logo-wordmark-lavender", load_clean(os.environ["LOGO_LAVENDER"]), dict(width=1200, margin=8)),
]
for name, src, kw in jobs:
    png = os.path.join(BRAND, name + ".png")
    save_png(logo(src, **kw), png)
    save_webp(png)
PY
fi

# --------------------------------------------------------------------------------------------
# 2. Icons: swirl mark (512, centred on the swirl's eye so CSS rotation does not wobble),
#    favicon 32 + apple-touch 180 + app icon 512.
# --------------------------------------------------------------------------------------------
if want icons; then
  log "icons"
  python3 - <<'PY'
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
from brandlib import BRAND, NIGHT, load_clean, content_box, resize, place, save_png, save_webp

pub = os.environ["PUB"]
mark = load_clean(os.environ["SWIRL_MARK"])
x0, y0, x1, y1 = content_box(mark)

# Eye of the swirl: centroid of the transparent hole inside the central third of the artwork.
a = np.asarray(mark.getchannel("A"))
cx0, cy0 = x0 + (x1 - x0) // 3, y0 + (y1 - y0) // 3
core = a[cy0 : y1 - (y1 - y0) // 3, cx0 : x1 - (x1 - x0) // 3] < 64
ys, xs = np.nonzero(core)
eye = (cx0 + xs.mean(), cy0 + ys.mean())
# Square crop centred on the eye that still contains all of the artwork.
half = max(eye[0] - x0, x1 - eye[0], eye[1] - y0, y1 - eye[1])
box = tuple(round(v) for v in (eye[0] - half, eye[1] - half, eye[0] + half, eye[1] + half))
print(f"  swirl eye at {eye[0]:.0f},{eye[1]:.0f} (artwork box {x0},{y0},{x1},{y1}), square crop {box}")
square = Image.new("RGBA", (box[2] - box[0], box[3] - box[1]), (0, 0, 0, 0))
square.alpha_composite(mark.crop((max(box[0], 0), max(box[1], 0), min(box[2], mark.width), min(box[3], mark.height))),
                       (max(-box[0], 0), max(-box[1], 0)))


def swirl_at(size, margin):
    inner = size - 2 * margin
    return place(resize(square, (inner, inner)), (size, size), (margin, margin))


icon = swirl_at(512, 8)
p = os.path.join(BRAND, "swirl-icon.png")
save_png(icon, p)
save_webp(p)

# Favicon: the transparent swirl reads on light and dark tabs; at 32 px a light unsharp mask
# keeps the gaps between the arms visible (the opaque app icon turns into a dark blob).
fav = swirl_at(32, 1).filter(ImageFilter.UnsharpMask(radius=0.6, percent=60, threshold=0))
save_png(fav, os.path.join(BRAND, "favicon-32.png"))
save_png(fav, os.path.join(pub, "favicon.png"))


def night_glow(size):
    """Square night background with the app icon's soft violet centre glow."""
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    r = np.hypot(xx - size / 2, yy - size / 2) / (size / 2)
    t = np.clip(1 - r, 0, 1) ** 1.6
    base = np.array(NIGHT, np.float32)
    glow = np.array((26, 22, 70), np.float32)
    rgb = base + (glow - base) * t[..., None]
    return Image.fromarray(np.round(rgb).astype(np.uint8)).convert("RGBA")


# Apple touch icon: iOS masks the corners itself and paints transparency black, so it gets an
# opaque, full-bleed square: swirl at 80% on the night glow.
touch = night_glow(180)
touch.alpha_composite(swirl_at(180, 18))
save_png(touch.convert("RGB"), os.path.join(pub, "apple-touch-icon.png"))

# App icon 512 (web manifest): the owner's opaque app icon with the black outside its rounded
# corners made transparent (shape traced from the artwork, anti-aliased by supersampling).
app = Image.open(os.environ["APP_ICON"]).convert("RGB")
lum = np.asarray(app).max(axis=2)
shape = Image.fromarray(np.where(lum > 8, 255, 0).astype(np.uint8))
outside = shape.copy()
for corner in [(0, 0), (app.width - 1, 0), (0, app.height - 1), (app.width - 1, app.height - 1)]:
    ImageDraw.floodfill(outside, corner, 128)
mask = Image.fromarray(np.where(np.asarray(outside) == 128, 0, 255).astype(np.uint8))
mask = mask.filter(ImageFilter.GaussianBlur(0.8))
rgba = app.convert("RGBA")
rgba.putalpha(mask)
bx = mask.getbbox()
rgba = rgba.crop(bx)
side = max(rgba.size)
sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
sq.alpha_composite(rgba, ((side - rgba.width) // 2, (side - rgba.height) // 2))
save_png(resize(sq, (512, 512)), os.path.join(BRAND, "app-icon-512.png"))
PY
fi

# --------------------------------------------------------------------------------------------
# Video helpers. CRFs were tuned on these sources (2026-10-03): intro 720p <= 1.5 MB and
# 1080p <= 3 MB; the logo reveal is mostly smooth gradient, so it gets a lower CRF.
# --------------------------------------------------------------------------------------------
COLOR=(-color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709)

# h264 SRC OUT FILTERGRAPH CRF [extra ffmpeg args...]
h264() {
  local src=$1 out=$2 vf=$3 crf=$4
  shift 4
  ffmpeg -nostdin -v error -y -i "$src" -an -vf "$vf" \
    -c:v libx264 -preset veryslow -profile:v high -crf "$crf" -pix_fmt yuv420p "${COLOR[@]}" \
    -movflags +faststart "$@" "$out"
}

# vp9 SRC OUT FILTERGRAPH CRF  (two-pass constant quality, alt-ref frames on)
vp9() {
  local src=$1 out=$2 vf=$3 crf=$4 log="$TMP/vp9-$(basename "$2")"
  local args=(-an -vf "$vf" -c:v libvpx-vp9 -b:v 0 -crf "$crf" -row-mt 1 -tile-columns 2
    -deadline good -auto-alt-ref 1 -lag-in-frames 25 -pix_fmt yuv420p "${COLOR[@]}")
  ffmpeg -nostdin -v error -y -i "$src" "${args[@]}" -cpu-used 4 -pass 1 -passlogfile "$log" -f null /dev/null
  ffmpeg -nostdin -v error -y -i "$src" "${args[@]}" -cpu-used 1 -pass 2 -passlogfile "$log" "$out"
}

sc() { echo "scale=$1:flags=lanczos"; }

# Run encodes in parallel; join fails the build if any of them failed.
JOBS=()
spawn() {
  "$@" &
  JOBS+=($!)
}
join() {
  local p
  for p in "${JOBS[@]}"; do wait "$p"; done
  JOBS=()
}

# last_frame SRC OUT.png  (the final decoded frame at source resolution)
last_frame() { ffmpeg -nostdin -v error -y -sseof -0.5 -i "$1" -update 1 "$2"; }

# jpeg IN OUT [WxH] [QUALITY]  (progressive, optimised, optional Lanczos resize)
jpeg() {
  python3 - "$@" <<'PY'
import sys
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
size = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] else None
q = int(sys.argv[4]) if len(sys.argv) > 4 else 84
im = Image.open(src).convert("RGB")
if size:
    w, h = map(int, size.split("x"))
    im = im.resize((w, h), Image.LANCZOS)
im.save(out, quality=q, optimize=True, progressive=True, subsampling="4:2:0")
print(f"  {out.split('/public/')[-1]}  {im.size[0]}x{im.size[1]}")
PY
}

# --------------------------------------------------------------------------------------------
# 3. Intro (assemble_6s_hold, full 6.04 s at 24 fps) and the PDF-generating clip (altB, 720p).
#    The WebM is 1080p (VP9 at CRF 46 is ~20% smaller than the 1080p H.264).
# --------------------------------------------------------------------------------------------
if want intro; then
  log "intro"
  spawn h264 "$V_INTRO" "$INTRO/assemble-1080.mp4" "$(sc 1920:1080)" 28
  spawn h264 "$V_INTRO" "$INTRO/assemble-720.mp4" "$(sc 1280:720)" 29.5
  spawn vp9 "$V_INTRO" "$INTRO/assemble.webm" "$(sc 1920:1080)" 46
  spawn h264 "$V_ALT" "$INTRO/assemble-alt-720.mp4" "$(sc 1280:720)" 29
  spawn vp9 "$V_ALT" "$INTRO/assemble-alt-720.webm" "$(sc 1280:720)" 48
  join
  last_frame "$V_INTRO" "$TMP/intro-last.png"
  jpeg "$TMP/intro-last.png" "$INTRO/assemble-poster.jpg" "" 84
  last_frame "$V_ALT" "$TMP/alt-last.png"
  jpeg "$TMP/alt-last.png" "$INTRO/assemble-alt-poster.jpg" 1280x720 84
fi

# --------------------------------------------------------------------------------------------
# 4. Sign-off (logo_5s 16:9 and 9:16, 24 fps), posters = final frame.
# --------------------------------------------------------------------------------------------
if want signoff; then
  log "signoff"
  spawn h264 "$V_LOGO" "$SIGNOFF/logo-reveal-1080.mp4" "$(sc 1920:1080)" 22
  spawn h264 "$V_LOGO" "$SIGNOFF/logo-reveal-720.mp4" "$(sc 1280:720)" 23
  spawn vp9 "$V_LOGO" "$SIGNOFF/logo-reveal.webm" "$(sc 1920:1080)" 30
  spawn h264 "$V_LOGO_P" "$SIGNOFF/logo-reveal-portrait-720.mp4" "$(sc 720:1280)" 23
  spawn vp9 "$V_LOGO_P" "$SIGNOFF/logo-reveal-portrait-720.webm" "$(sc 720:1280)" 30
  join
  last_frame "$V_LOGO" "$TMP/logo-last.png"
  jpeg "$TMP/logo-last.png" "$SIGNOFF/logo-reveal-poster.jpg" "" 84
  last_frame "$V_LOGO_P" "$TMP/logo-p-last.png"
  jpeg "$TMP/logo-p-last.png" "$SIGNOFF/logo-reveal-portrait-poster.jpg" 720x1280 84
fi

# --------------------------------------------------------------------------------------------
# 5. Swirl loop: HLS ladder like public/media/vortex-swirl (540p + 1080p, 30 fps, 4 s
#    segments, a keyframe at every segment start), poster = first frame, 720p MP4 fallback.
#    60 -> 30 fps keeps every other frame (framestep=2), so the 5 s loop stays seamless:
#    frame 298 -> frame 0 is the same 2-frame step as every other pair.
# --------------------------------------------------------------------------------------------
if want swirl; then
  log "swirl loop"
  rm -rf "$SWIRL/540p" "$SWIRL/1080p"
  mkdir -p "$SWIRL/540p" "$SWIRL/1080p"
  SWIRL_VF="framestep=2,setpts=N/(30*TB)"
  hls() { # SIZE LEVEL CRF MAXRATE BUFSIZE
    local s=$1
    ffmpeg -nostdin -v error -y -i "$V_SWIRL" -an -vf "$SWIRL_VF,$(sc "$s:$s")" -r 30 \
      -c:v libx264 -preset veryslow -profile:v high -level:v "$2" -crf "$3" -maxrate "$4" -bufsize "$5" \
      -g 120 -keyint_min 120 -sc_threshold 0 -force_key_frames "expr:gte(t,n_forced*4)" \
      -pix_fmt yuv420p "${COLOR[@]}" \
      -f hls -hls_time 4 -hls_playlist_type vod -hls_segment_type mpegts \
      -hls_segment_filename "$SWIRL/${s}p/seg_%03d.ts" "$SWIRL/${s}p/index.m3u8"
  }
  spawn hls 540 3.0 23 1000k 2000k
  spawn hls 1080 4.0 22 3000k 6000k
  spawn h264 "$V_SWIRL" "$SWIRL/swirl-720.mp4" "$SWIRL_VF,$(sc 720:720)" 24 -r 30
  join
  ffmpeg -nostdin -v error -y -i "$V_SWIRL" -frames:v 1 "$TMP/swirl-first.png"
  jpeg "$TMP/swirl-first.png" "$SWIRL/poster.jpg" "" 84

  # Master playlist: BANDWIDTH = peak segment bitrate, AVERAGE-BANDWIDTH = whole-stream bitrate.
  python3 - "$SWIRL" <<'PY'
import os, re, sys
root = sys.argv[1]
rungs = [("540p", 540, "avc1.64001e"), ("1080p", 1080, "avc1.640028")]  # High@3.0, High@4.0
lines = ["#EXTM3U", "#EXT-X-VERSION:3"]
for name, size, codecs in rungs:
    pl = open(os.path.join(root, name, "index.m3u8")).read()
    segs = re.findall(r"#EXTINF:([\d.]+),\s*\n(\S+)", pl)
    peaks, total_b, total_t = [], 0, 0.0
    for dur, seg in segs:
        b = os.path.getsize(os.path.join(root, name, seg)) * 8
        peaks.append(b / float(dur))
        total_b += b
        total_t += float(dur)
    lines.append(
        f"#EXT-X-STREAM-INF:BANDWIDTH={round(max(peaks))},AVERAGE-BANDWIDTH={round(total_b / total_t)},"
        f'RESOLUTION={size}x{size},CODECS="{codecs}"'
    )
    lines.append(f"{name}/index.m3u8")
    lines.append("")
open(os.path.join(root, "master.m3u8"), "w").write("\n".join(lines))
print(open(os.path.join(root, "master.m3u8")).read())
PY
fi

# --------------------------------------------------------------------------------------------
# 5b. ASCII sampling clip: what the hero's ASCII vortex (src/components/landing/ascii) samples.
#     Half speed without dropping a frame: setpts=N/(30*TB) lays the 300 frames of the 60 fps,
#     5 s master out at 30 fps, so the loop lasts 10 s, still with 30 unique frames a second, and
#     stays seamless (frame 299 -> frame 0 is the master's own step). 540 px square is enough for
#     the finest grid (~5 px cells over a ring as tall as the viewport); CRF 28 keeps it ~750 KB.
#     The first frame is the master's first frame, so swirl-loop/poster.jpg (the reduced-motion
#     and server-rendered still) matches the clip's start.
# --------------------------------------------------------------------------------------------
if want ascii; then
  log "ascii sampling clip"
  ffmpeg -nostdin -v error -y -threads 2 -i "$V_SWIRL" -an -vf "setpts=N/(30*TB),$(sc 540:540)" -r 30 \
    -c:v libx264 -preset veryslow -profile:v high -crf 28 -pix_fmt yuv420p "${COLOR[@]}" \
    -movflags +faststart -threads 2 "$SWIRL/swirl-ascii-540.mp4"
fi

# --------------------------------------------------------------------------------------------
# 5c. Promo films for the homepage (FilmsSection): Film 1 "Clientul așteaptă. Tu nu vezi."
#     (Vortex Scan) and Film 2 "Din 100 de lei, cât îți rămâne?" (Deep Research), each 20.0 s,
#     1080x1920, 30 fps, silent masters, plus their lossless frame-0 posters. The sound is muxed
#     in here: the film's music + sound effects mix at -18 LUFS (calmer than the -14 LUFS social
#     cut when a visitor turns it on), AAC-LC 128 kb/s, 48 kHz stereo, about 0.3 MB per film. The
#     licences of the music and the sound effects allow them only inside the film's audio track,
#     so no raw music or SFX file ever goes into /public. 720x1280 is enough: the
#     films show 240-340 CSS px wide, and even at 3x on a phone the 720 frames read as sharp as
#     the 1080 ones. CRF 24 with aq-mode 3 (tuned 2026-10-05) leaves no banding in the swirl and
#     no smear on the bold type or the small UI text, at about 2.8 MB (scan) and 3.6 MB (deep)
#     of video; with the sound about 3.2 MB and 3.9 MB, under the 4 MB budget the verify step checks.
#     No WebM: VP9 came out no smaller at the same quality. The poster is frame 0 (the opening
#     hook), the film's own first frame, so the swap to playback shows no jump.
# --------------------------------------------------------------------------------------------
if want films; then
  log "promo films"
  # The renders (with their lossless posters) live in FILMS_SRC: v03 = v01 without the small
  # labels ("Date de exemplu · secvențe scurtate", "Exemplu cu o firmă inventată", "Text redactat
  # cu AI"), the owner's call on 2026-10-05; every other frame and timing is v01's. FILMS_ALT holds
  # the v01 copies the owner delivered (VortexPromo1.mp4 scan, VortexPromo2.mp4 deep), labels
  # included, as a fallback only. Without a poster PNG the poster is decoded from the film's
  # frame 0, which is what the PNG shows.
  FILMS_SRC="${FILMS_SRC:-$HOME/Desktop/VortexHub-videos}"
  FILMS_ALT="${FILMS_ALT:-$HOME/Desktop/Assigments/Dandea Mihai/VortexHub/Vids}"
  FILMS_AUDIO="${FILMS_AUDIO:-$HOME/Desktop/VortexHub-videos/out-audio/mixes}"
  FILMS_MIX="${FILMS_MIX:-novo}"
  PROMO="$PUB/media/promo"
  mkdir -p "$PROMO"
  for key in scan deep; do
    src="$FILMS_SRC/vortexhub_${key}_ro_20s_9x16_v03.mp4"
    [[ -f $src ]] || src="$FILMS_ALT/VortexPromo$([[ $key == scan ]] && echo 1 || echo 2).mp4"
    if [[ ! -f $src ]]; then
      echo "  skipped $key: no film in $FILMS_SRC or $FILMS_ALT (set FILMS_SRC or FILMS_ALT)"
      continue
    fi
    audio="$FILMS_AUDIO/${key}_mix_${FILMS_MIX}_-18LUFS.wav"
    if [[ ! -f $audio ]]; then
      echo "  no sound for $key: $audio is missing (run ~/Desktop/VortexHub-videos/audio-src/mix.sh, or set FILMS_AUDIO)" >&2
      exit 1
    fi
    poster="$FILMS_SRC/vortexhub_${key}_ro_poster_9x16_v03.png"
    if [[ ! -f $poster ]]; then
      ffmpeg -nostdin -v error -y -i "$src" -frames:v 1 -pix_fmt rgb24 "$TMP/$key-poster-src.png"
      poster="$TMP/$key-poster-src.png"
    fi
    echo "  $key: $src + $audio"
    ffmpeg -nostdin -v error -y -threads 4 -i "$src" -i "$audio" \
      -map 0:v:0 -map 1:a:0 -vf "$(sc 720:1280),format=yuv420p" -r 30 \
      -c:v libx264 -preset slow -profile:v high -level:v 4.0 -crf 24 -g 60 \
      -x264-params aq-mode=3:threads=4 -pix_fmt yuv420p "${COLOR[@]}" \
      -c:a aac -b:a 128k -ar 48000 -ac 2 -metadata:s:a:0 language=ron -shortest \
      -movflags +faststart "$PROMO/$key-film-720.mp4"
    ffmpeg -nostdin -v error -y -i "$poster" \
      -vf "$(sc 720:1280)" -pix_fmt rgb24 "$TMP/$key-film-poster.png"
    cwebp -quiet -q 84 -m 6 -sharp_yuv "$TMP/$key-film-poster.png" -o "$PROMO/$key-film-poster.webp"
    ffmpeg -nostdin -v error -y -threads 4 -i "$TMP/$key-film-poster.png" \
      -vf "scale=out_color_matrix=bt709:out_range=full,format=yuv420p" \
      -c:v libaom-av1 -still-picture 1 -crf 30 -cpu-used 4 \
      -colorspace bt709 -color_primaries bt709 -color_trc iec61966-2-1 -color_range pc \
      "$PROMO/$key-film-poster.avif"
  done
  ls -l "$PROMO"
fi

# --------------------------------------------------------------------------------------------
# 6. Stills. OG image: the logo reveal at 2.2 s (wordmark lit, violet glow behind it), scaled to
#    1200 wide and centre-cropped to 1200x630. PDF cover art: A4 portrait at 150 dpi
#    (1240x1754), no wordmark: night base, violet + blue glows (the PDF theme's colours), the
#    swirl (first frame of the loop) screen-blended into the upper right and bleeding off the
#    edge, faint stars, and a calm lower third for the title block.
# --------------------------------------------------------------------------------------------
if want stills; then
  log "stills"
  ffmpeg -nostdin -v error -y -ss 2.2 -i "$V_LOGO" -frames:v 1 "$TMP/og-frame.png"
  ffmpeg -nostdin -v error -y -i "$V_SWIRL" -frames:v 1 "$TMP/swirl-frame.png"
  python3 - "$TMP/og-frame.png" "$TMP/swirl-frame.png" <<'PY'
import os, sys
import numpy as np
from PIL import Image, ImageDraw

pub = os.environ["PUB"]
og_src, swirl_src = sys.argv[1], sys.argv[2]


def save_jpeg(im, path, q):
    im.save(path, quality=q, optimize=True, progressive=True, subsampling="4:2:0")
    print(f"  {os.path.relpath(path, pub)}  {im.size[0]}x{im.size[1]}  {os.path.getsize(path) // 1024} KB")


# OG image 1200x630.
frame = Image.open(og_src).convert("RGB").resize((1200, 675), Image.LANCZOS)
top = (675 - 630) // 2
save_jpeg(frame.crop((0, top, 1200, top + 630)), os.path.join(pub, "og-image.jpg"), 86)

# PDF cover art.
W, H = 1240, 1754
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)


def rgb(hexstr):
    return np.array([int(hexstr[i : i + 2], 16) for i in (1, 3, 5)], np.float32) / 255.0


night, violet, blue = rgb("#00020f"), rgb("#6c63ff"), rgb("#5b8cf0")


def glow(cx, cy, r):
    d = np.hypot(xx - cx * W, yy - cy * H) / (r * W)
    return np.exp(-(d**2) * 2.2)[..., None]


# Swirl: 1.05x the page width, centred at (68%, 27%), screen-blended (black stays untouched).
D = round(W * 1.05)
cx, cy = round(W * 0.68), round(H * 0.27)

# Glows: a tight violet halo behind the swirl, a faint ambient wash, a blue pool bottom left;
# the swirl's eye is kept dark so it reads as depth rather than a lit disc.
img = np.broadcast_to(night, (H, W, 3)).copy()
img += violet * 0.40 * glow(cx / W, cy / H, 0.58)
img += violet * 0.08 * glow(0.5, 0.35, 1.2)
img += blue * 0.14 * glow(0.0, 1.0, 0.55)
eye = np.exp(-((np.hypot(xx - cx, yy - cy) / (D * 0.16)) ** 2))[..., None]
img = night + (img - night) * (1 - 0.85 * eye)
sw = np.asarray(Image.open(swirl_src).convert("RGB").resize((D, D), Image.LANCZOS), np.float32) / 255.0
layer = np.zeros((H, W, 3), np.float32)
x0, y0 = cx - D // 2, cy - D // 2
sx0, sy0 = max(0, -x0), max(0, -y0)
dx0, dy0 = max(0, x0), max(0, y0)
w = min(W - dx0, D - sx0)
h = min(H - dy0, D - sy0)
layer[dy0 : dy0 + h, dx0 : dx0 + w] = sw[sy0 : sy0 + h, sx0 : sx0 + w]
layer *= 0.92
img = 1 - (1 - np.clip(img, 0, 1)) * (1 - layer)

# Stars: deterministic, drawn at 2x and downsampled for soft round dots.
rng = np.random.default_rng(20261003)
stars = Image.new("L", (W * 2, H * 2), 0)
dr = ImageDraw.Draw(stars)
for _ in range(520):
    x, y = rng.uniform(0, W * 2), rng.uniform(0, H * 2)
    r = rng.choice([0.9, 1.2, 1.6, 2.2, 3.0], p=[0.35, 0.3, 0.2, 0.1, 0.05])
    v = int(rng.uniform(70, 230))
    dr.ellipse((x - r, y - r, x + r, y + r), fill=v)
stars = np.asarray(stars.resize((W, H), Image.LANCZOS), np.float32)[..., None] / 255.0
star_tint = np.array([0.86, 0.85, 1.0], np.float32)
img = 1 - (1 - img) * (1 - stars * star_tint * 0.75)

# Calm lower third: ease the art back to night towards the bottom (title and meta sit there).
t = np.clip((yy / H - 0.52) / 0.48, 0, 1)
fade = (t * t * (3 - 2 * t))[..., None] * 0.55
img = img * (1 - fade) + night * fade

out = Image.fromarray(np.round(np.clip(img, 0, 1) * 255).astype(np.uint8))
save_jpeg(out, os.path.join(os.environ["BRAND"], "cover-art.jpg"), 84)
PY
fi

# --------------------------------------------------------------------------------------------
# 7. Verify: stream format of every video (H.264 High / VP9, yuv420p, no audio, faststart),
#    true black in the corners of the first, middle and last frames of the brand and swirl
#    videos (the site screen-blends these; the promo films are opaque, so no corner rule:
#    instead H.264, one AAC track, 20.0 s and at most 4 MB each), the swirl loop seam, and the size of every
#    output file.
# --------------------------------------------------------------------------------------------
if want verify; then
  log "verify"
  python3 - <<'PY'
import glob, json, os, subprocess
import numpy as np

pub = os.environ["PUB"]


def probe(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", path],
        capture_output=True, text=True, check=True,
    ).stdout
    return json.loads(out)


def frame(path, where, w, h):
    """RGB frame: where = "first", "last" or a time in seconds."""
    if where == "first":
        seek, take = [], ["-frames:v", "1"]
    elif where == "last":
        # A TS segment is one GOP, so seeking near its end finds no keyframe: decode it all.
        seek, take = ([] if path.endswith(".ts") else ["-sseof", "-0.5"]), []
    else:
        seek, take = ["-ss", f"{where:.3f}"], ["-frames:v", "1"]
    raw = subprocess.run(
        ["ffmpeg", "-nostdin", "-v", "error", *seek, "-i", path, *take,
         "-s", f"{w}x{h}", "-f", "image2pipe", "-vcodec", "rawvideo", "-pix_fmt", "rgb24", "-"],
        capture_output=True, check=True,
    ).stdout
    return np.frombuffer(raw, np.uint8)[-w * h * 3 :].reshape(h, w, 3)


def corners(f):
    k = max(4, f.shape[0] // 40)
    return int(max(f[:k, :k].max(), f[:k, -k:].max(), f[-k:, :k].max(), f[-k:, -k:].max()))


def frames_at(path, idx, w, h):
    sel = "+".join(f"eq(n\\,{i})" for i in idx)
    raw = subprocess.run(
        ["ffmpeg", "-nostdin", "-v", "error", "-i", path, "-vf", f"select='{sel}',scale={w}:{h}",
         "-vsync", "0", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        capture_output=True, check=True,
    ).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3).astype(np.int16)


videos = sorted(glob.glob(f"{pub}/media/brand/**/*.mp4", recursive=True)
                + glob.glob(f"{pub}/media/brand/**/*.webm", recursive=True)
                + glob.glob(f"{pub}/media/swirl-loop/*.mp4") + glob.glob(f"{pub}/media/swirl-loop/*/seg_000.ts"))
problems = []
for v in videos:
    info = probe(v)
    vs = [s for s in info["streams"] if s["codec_type"] == "video"][0]
    audio = [s for s in info["streams"] if s["codec_type"] == "audio"]
    dur = float(info["format"].get("duration", 0))
    w, h = vs["width"], vs["height"]
    # Black must be true black where the frame is meant to be empty: the first and the final
    # frame (the hold that the posters show). Mid-animation glows may reach the corners.
    sw, sh = w // 4, h // 4  # a quarter-size decode is plenty to read the corners
    corner = max(corners(frame(v, "first", sw, sh)), corners(frame(v, "last", sw, sh)))
    faststart = ""
    if v.endswith(".mp4"):
        head = open(v, "rb").read(4096)
        faststart = " faststart" if head.find(b"moov") != -1 and (head.find(b"mdat") == -1 or head.find(b"moov") < head.find(b"mdat")) else " NO-FASTSTART"
        if "NO" in faststart:
            problems.append(f"{v}: moov atom after mdat")
    fps = vs.get("avg_frame_rate") if vs.get("avg_frame_rate") not in (None, "0/0") else vs.get("r_frame_rate")
    print(f"  {os.path.relpath(v, pub):52s} {vs['codec_name']:4s} {vs.get('profile', ''):9s} {vs.get('pix_fmt')} "
          f"{w}x{h} {fps:>5s} fps {dur:5.2f}s audio={len(audio)} corner-max={corner}{faststart}")
    if audio:
        problems.append(f"{v}: has audio")
    if corner > 3:
        problems.append(f"{v}: corners not black ({corner})")
    if vs.get("pix_fmt") != "yuv420p":
        problems.append(f"{v}: pix_fmt {vs.get('pix_fmt')}")

# The promo films are not screen-blended (swirl reaches their corners on frame 0), so they skip
# the true-black rule: faststart, H.264 yuv420p, exactly one audio track (AAC-LC, 48 kHz stereo:
# the music + sound effects mix), 20.0 s and at most 4 MB each.
promo = sorted(glob.glob(f"{pub}/media/promo/*.mp4"))
if not promo:
    problems.append("media/promo: no films")
for v in promo:
    info = probe(v)
    vs = [s for s in info["streams"] if s["codec_type"] == "video"][0]
    audio = [s for s in info["streams"] if s["codec_type"] == "audio"]
    head = open(v, "rb").read(4096)
    dur = float(info["format"]["duration"])
    size = os.path.getsize(v)
    moov, mdat = head.find(b"moov"), head.find(b"mdat")
    print(f"  {os.path.relpath(v, pub):52s} {vs['codec_name']:4s} {vs.get('profile', ''):9s} {vs.get('pix_fmt')} "
          f"{vs['width']}x{vs['height']} {vs.get('avg_frame_rate'):>5s} fps {dur:5.2f}s audio={len(audio)}"
          + (f" ({audio[0]['codec_name']} {audio[0].get('sample_rate')} Hz {audio[0].get('channels')} ch "
             f"{int(audio[0].get('bit_rate', 0)) // 1000} kb/s)" if audio else "")
          + f" {size / 1048576:.2f} MB")
    if len(audio) != 1:
        problems.append(f"{v}: {len(audio)} audio tracks, expected one AAC track")
    elif audio[0]["codec_name"] != "aac" or audio[0].get("sample_rate") != "48000" or audio[0].get("channels") != 2:
        problems.append(f"{v}: audio {audio[0]['codec_name']} {audio[0].get('sample_rate')} Hz "
                        f"{audio[0].get('channels')} ch, expected AAC 48000 Hz stereo")
    if moov == -1 or (mdat != -1 and moov > mdat):
        problems.append(f"{v}: moov atom after mdat")
    if vs["codec_name"] != "h264" or vs.get("pix_fmt") != "yuv420p":
        problems.append(f"{v}: {vs['codec_name']} {vs.get('pix_fmt')}, expected h264 yuv420p")
    if abs(dur - 20.0) > 0.02:
        problems.append(f"{v}: {dur:.3f} s, expected 20.0 s")
    if size > 4 * 1024 * 1024:
        problems.append(f"{v}: {size} bytes, over 4 MB")

# Swirl loop seams (the 720p fallback and the ASCII sampling clip): last -> first frame must look
# like any other consecutive pair.
for mp4 in (f"{pub}/media/swirl-loop/swirl-720.mp4", f"{pub}/media/swirl-loop/swirl-ascii-540.mp4"):
    if not os.path.exists(mp4):
        problems.append(f"{os.path.relpath(mp4, pub)} missing")
        continue
    n = int(probe(mp4)["streams"][0]["nb_frames"])
    F = frames_at(mp4, [0, 1, 2, 3, n - 3, n - 2, n - 1], 360, 360)
    steps = [np.abs(F[i + 1] - F[i]).mean() for i in (0, 1, 2, 4, 5)]
    seam = np.abs(F[0] - F[6]).mean()
    name = os.path.basename(mp4)
    print(f"  {name}: {n} frames; consecutive-frame difference {min(steps):.2f}-{max(steps):.2f}, seam (last->first) {seam:.2f}")
    if seam > max(steps) * 1.25:
        problems.append(f"{name} seam {seam:.2f} vs steps up to {max(steps):.2f}")

print("\n  sizes")
outs = sorted(
    glob.glob(f"{pub}/media/brand/**/*", recursive=True) + glob.glob(f"{pub}/media/swirl-loop/**/*", recursive=True)
    + glob.glob(f"{pub}/media/promo/*")
    + [f"{pub}/favicon.png", f"{pub}/apple-touch-icon.png", f"{pub}/og-image.jpg"]
)
for p in outs:
    if os.path.isfile(p):
        print(f"  {os.path.getsize(p) / 1024:8.1f} KB  {os.path.relpath(p, pub)}")
budgets = {"media/brand/intro/assemble-720.mp4": 1.5e6, "media/brand/intro/assemble-1080.mp4": 3e6,
           "og-image.jpg": 200e3, "media/brand/cover-art.jpg": 300e3}
for rel, cap in budgets.items():
    if os.path.getsize(f"{pub}/{rel}") > cap:
        problems.append(f"{rel} over budget ({os.path.getsize(f'{pub}/{rel}')} > {cap:.0f} bytes)")

# media.ts states each logo's pixel size (img width/height, the PDF's logo ratios): it must
# match the files, which change size whenever the trim above changes.
import re
from PIL import Image
ts = open(os.path.join(os.path.dirname(pub), "src/components/landing/media.ts")).read()
for path, w, h in re.findall(r'png: "(/media/brand/[^"]+\.png)",\s*width: (\d+),\s*height: (\d+)', ts):
    for f in (path, path[:-4] + ".webp"):
        size = Image.open(pub + f).size
        if size != (int(w), int(h)):
            problems.append(f"media.ts says {f} is {w}x{h}, the file is {size[0]}x{size[1]}")
if problems:
    print("\n  PROBLEMS:\n  " + "\n  ".join(problems))
    raise SystemExit(1)
print("\n  all checks passed")
PY
fi
