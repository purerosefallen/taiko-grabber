# Taiko Web chart grabber
A script to grab all datas from another website of Taiko Web, and use them with your own Taiko Web. But you had better ask the website owner before running this script.

## How to use

1. Copy `config.sample.json` to `config.json`, and write your config, including the target website. You may refer to the web console for `song_baseurl` and `song_api`. The example is Bui's Taiko Web.

2. `node run.js`.

3. Copy out the songs in `output` folder, or the output folder of your choice.

4. Run all the SQL commands with your `taiko.db` from `output.sql`, to generate the database. Then, upload all the chart files, and enjoy!
