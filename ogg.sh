#!/bin/bash
ls | xargs  -I {} bash -c 'cd {} && mpg321 main.mp3 -w main.wav && oggenc main.wav -o main.ogg && rm -rf main.wav main.mp3'
