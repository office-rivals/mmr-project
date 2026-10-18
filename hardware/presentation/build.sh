#!/bin/sh
# Assemble index.html: head.part.html (styles) + slides.part.html + tail.part.html (rail, notes, script)
cd "$(dirname "$0")"
n=$(grep -c '<section class="slide' slides.part.html)
{ echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>The Agent Company</title>'
  cat head.part.html
  printf '</head><body>\n<div id="viewport">\n  <div id="stage">\n    <div id="mark">&amp;</div>\n'
  cat slides.part.html
  sed "s#01 / 22#01 / $n#" tail.part.html
} > index.html
