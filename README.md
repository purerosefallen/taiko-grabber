# Taiko Web chart grabber
A script to grab all datas from another website of Taiko Web for your own Taiko Web. But you had better ask the website owner before running this script.

## How to use
1. `npm install` or `npm ci`.
2. Copy `config.sample.json` to `config.json`, and write your config, including the target website. You may refer to the web console for `song_baseurl` and `song_api`. The example is Bui's Taiko Web.
3. `node run.js`.
4. Copy out the songs in `output` folder, or the output folder of your choice.
5. Run all the SQL commands with your `taiko.db` from `output.sql` to generate the database. Then, upload all the chart files from output folder.
6. Enjoy!
