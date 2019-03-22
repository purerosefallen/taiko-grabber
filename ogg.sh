#!/bin/bash
ls | xargs -P $(grep -c processor /proc/cpuinfo) -I {} bash -c 'cd {} && mpg321 main.mp3 -w raw && oggenc raw -o main.ogg && rm -rf raw main.mp3'
