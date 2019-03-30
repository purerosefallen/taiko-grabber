const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const request = require('request');
const config = require('./config.json');

const categories = {
	"J-POP": 1,
	"アニメ": 2,
	"ボーカロイド™曲": 3,
	"バラエティ": 4,
	"クラシック": 5,
	"ゲームミュージック": 6,
	"ナムコオリジナル": 7,
}

var sqls = [];

var tasks = 0;

function download_file(uri, dirname, fname) { 
	if (!fs.existsSync(dirname))
		fs.mkdirSync(dirname);
	const filename = dirname + "/" + fname;
	var stream = fs.createWriteStream(filename);
	tasks++;
	console.log("Downloading file.", uri, filename, tasks)
	request(uri).pipe(stream).on('close', () => {
		tasks--;
		console.log("Download complete.", uri, filename, tasks)
	}); 
}

function look(song, key) {
	const data = song[key];
	if (data) {
		if (typeof (data) == "string")
			return "'" + data.replace("'","''") + "'";
		else
			return data;
	} else
		return "NULL";
}

function direct_return(data) {
	if (data) {
		if (typeof (data) == "string")
			return "'" + data.replace("'","''") + "'";
		else
			return data;
	} else
		return "NULL";
}

function write_db(song, new_song_id) { 
	const data = "INSERT INTO songs VALUES("
		+ direct_return(new_song_id) + ","
		+ look(song, "title") + ","
		+ look(song, "ttitle_lang") + ","
		+ look(song, "subtitle") + ","
		+ look(song, "subtitle_lang") + ","
		+ look(song.stars, 0) + ","
		+ look(song.stars, 1) + ","
		+ look(song.stars, 2) + ","
		+ look(song.stars, 3) + ","
		+ look(song.stars, 4) + ","
		+ direct_return(1) + ","
		+ direct_return(categories[song.category]) + ","
		+ look(song, "type") + ","
		+ direct_return(song.offset || 0) + ","
		+ direct_return(null) + ","
		+ look(song, "preview") + ","
		+ look(song, "volume")
		+ ");";
	sqls.push(data);
	console.log("Song DB written.", song.title)
}

if(!fs.existsSync(config.output))
	fs.mkdirSync(config.output)

console.log("Fetching song list.", config.song_api)
request({
	url: config.song_api,
	json: true
}, (error, response, body) => { 
		if (error || !body) { 
			console.error("Errored fetching song list.", error);
			return;
		}
		var old_songs = [];
		console.log("Reading existing database.", config.old_db);
		var db = new sqlite3.Database(config.old_db);
		db.each("select * from songs", (err, result) => { 
			if (err) {
				console.log("Errored reading existing database.", err);
				return;
			}
			old_songs.push(result.title);
		}, () => { 
			console.log("Finished reading database.", old_songs.length);
			for (var song of body) { 
				console.log("Handling song data.", song.id, song.title);
				if (old_songs.indexOf(song.title) >= 0) { 
					console.log("The following song is existing, skipped.", song.id, song.title)
					continue;
				}
				const new_song_id = Math.floor(Math.random() * 1000000);
				download_file(config.song_baseurl + "/" + song.id + "/main.mp3", config.output + "/" + new_song_id, "main.mp3");
				if (song.type === "tja") {
					download_file(config.song_baseurl + "/" + song.id + "/main.tja", config.output + "/" + new_song_id, "main.tja");
				} else { 
					const diffs = ["easy", "normal", "hard", "oni", "ura"]
					for (var i = 0; i < 5; ++i) {
						if (song.stars[i] != null) {
							download_file(config.song_baseurl + "/" + song.id + "/" + diffs[i] + ".osu", config.output + "/" + new_song_id, diffs[i] + ".osu");
						}
					}
				}
				write_db(song, new_song_id);
			}
			fs.writeFileSync(config.sql_output, sqls.join("\n"))
			console.log("SQL file written in the following path.", config.sql_output)
		})
})
