#!/bin/sh
# Build and render one film:  tools/build.sh en|scoreboard|teaser|teaser-short|teaser-short-counter|sounds
#   en          the goal-counter film (this folder)   -> ../goal-counter.mp4, ../goal-counter.en.srt (English only, 2026-10-18)
#   scoreboard  the scoreboard film (../scoreboard)   -> ../scoreboard.mp4, ../scoreboard.en.srt
#   teaser      the teaser (../teaser): no voice, no subtitles -> ../teaser.mp4, ../teaser-poster.png
#   teaser-short  the 11 s teaser (../teaser-short): SFX only -> ../teaser-short.mp4, ../teaser-short.jpg
#   teaser-short-counter  the 8 s goal-counter teaser (../teaser-short-counter) -> ../teaser-short-counter.mp4, .jpg
#   pr          the PR walkthrough for reviewers (../pr-walkthrough, narrated) -> ../pr-walkthrough[-cc].mp4 + .en.srt
#   player, admin  the UI flow films (../flows, admin-ui's recordings) -> ../player-flow.mp4, ../admin-flow.mp4
#   sounds      the scoreboard sounds v2 preview (../sounds/preview) -> ../sounds/sounds-v2-preview[-speaker|-buzzer].mp4
#   <name>.mp4     narration subtitles drawn into the picture
#   <name>-cc.mp4  clean picture + the .srt as a soft subtitle track (on by default)
# Narration must exist (FILM_DIR=<folder> tools/vo.py <lang>). Leaves each folder's index.html built for English.
set -e
TOOLS="$(cd "$(dirname "$0")" && pwd)"
case "$1" in
  en) DIR=..; LANG_ID=en; NAME=goal-counter; SRT=goal-counter.en; ISO=eng; TITLE=English ;;
  scoreboard) DIR=../../scoreboard; LANG_ID=en; NAME=scoreboard; SRT=scoreboard.en; ISO=eng; TITLE=English ;;
  pr) DIR=../../pr-walkthrough; LANG_ID=en; NAME=pr-walkthrough; SRT=pr-walkthrough.en; ISO=eng; TITLE=English
      python3 "$TOOLS/../../pr-walkthrough/tools/excerpts.py" ;;
  player|admin)
    cd "$TOOLS/../../flows"
    python3 tools/build.py "$1"
    cd "$1"
    npx hyperframes check
    npx hyperframes render -o "../../$1-flow.mp4" --quality delivery
    exit 0 ;;
  teaser)
    cd "$TOOLS/../../teaser"
    python3 tools/sound.py
    npx hyperframes check
    npx hyperframes render -o ../teaser.mp4 --quality delivery
    ffmpeg -v error -y -ss 41 -i ../teaser.mp4 -frames:v 1 ../teaser-poster.png
    exit 0 ;;
  teaser-short)
    cd "$TOOLS/../../teaser-short"
    python3 tools/sound.py
    npx hyperframes check
    npx hyperframes render -o ../teaser-short.mp4 --quality delivery
    ffmpeg -v error -y -ss 3.55 -i ../teaser-short.mp4 -frames:v 1 -q:v 2 ../teaser-short.jpg   # the 10 : 7 snap
    exit 0 ;;
  teaser-short-counter)
    cd "$TOOLS/../../teaser-short-counter"
    python3 tools/sound.py
    npx hyperframes check
    npx hyperframes render -o ../teaser-short-counter.mp4 --quality delivery
    ffmpeg -v error -y -ss 1.9 -i ../teaser-short-counter.mp4 -frames:v 1 -q:v 2 ../teaser-short-counter.jpg   # the beam broken
    exit 0 ;;
  sounds)
    cd "$TOOLS/../../sounds"
    python3 tools/render.py
    python3 tools/buzzer.py
    cd preview
    for V in buzzer speaker master; do
      python3 tools/build.py $V
      npx hyperframes check
      OUT=../sounds-v2-preview; [ $V != master ] && OUT=$OUT-$V
      npx hyperframes render -o $OUT.mp4 --quality delivery
    done
    exit 0 ;;
  *) echo "usage: tools/build.sh en|scoreboard|pr|player|admin|teaser|teaser-short|teaser-short-counter|sounds" >&2; exit 2 ;;
esac
FILM_DIR="$(cd "$TOOLS/$DIR" && pwd)"
export FILM_DIR
cd "$FILM_DIR"
BASE="../$NAME"
python3 "$TOOLS/words.py" "$LANG_ID"
python3 "$TOOLS/retime.py" "$LANG_ID"
python3 "$TOOLS/sound.py" "$LANG_ID"
npx hyperframes check
npx hyperframes render -o "$BASE.mp4" --quality delivery
python3 "$TOOLS/retime.py" "$LANG_ID" --no-subs
npx hyperframes render -o "$BASE-clean.tmp.mp4" --quality delivery
ffmpeg -v error -y -i "$BASE-clean.tmp.mp4" -i "../$SRT.srt" -map 0 -map 1 -c copy -c:s mov_text \
  -metadata:s:s:0 language=$ISO -metadata:s:s:0 title=$TITLE -disposition:s:0 default "$BASE-cc.mp4"
rm "$BASE-clean.tmp.mp4"
python3 "$TOOLS/retime.py" en
