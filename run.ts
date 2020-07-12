import fs, { ReadStream } from "fs";
import loadJSON from "load-json-file";
import {ProxyFetcher, ProxyConfig} from "./proxy";
import _ from "underscore";
import { AxiosRequestConfig } from "axios";

interface Config {
	"song_api": string,
	"song_baseurl": string,
	"song_type": "mp3" | "ogg",
	"output": string,
	"old_db_file": string,
	"proxy": ProxyConfig,
	"customFetchOptions": AxiosRequestConfig,
	"random_song_id": boolean
}

interface Course {
	branch: boolean,
	stars: number
}

interface Maker {
	id: number,
	name: string,
	url: string
}

interface Courses {
	"easy": Course,
	"hard": Course,
	"normal": Course,
	"oni": Course,
	"ura": Course
}

interface Lang {
	cn: string,
	en: string,
	ja: string,
	ko: string,
	tw: string
}

interface SongAPIData {
	"category": string,
	"category_id": number,
	"courses": Courses,
	"hash": string,
	"id": number,
	"maker": Maker,
	"offset": number,
	"order": number,
	"preview": number,
	"song_skin": any,
	"subtitle": string,
	"subtitle_lang": Lang,
	"title": any,
	"title_lang": Lang,
	"type": string,
	"volume": number
}

interface SongDBData {
	"skin_id": number,
	"title": string,
	"category_id": number,
	"enabled": boolean,
	"type": string,
	"courses": Courses,
	"volume": number,
	"id": number,
	"preview": number,
	"order": number,
	"title_lang": Lang,
	"hash": string,
	"offset": number,
	"maker_id": number,
	"subtitle": string,
	"subtitle_lang": Lang,
	"lyrics": boolean
}

let config: Config;

let existingSongs: SongDBData[] = [];

let songPath: string;

let remainingCount = 0;

let fetcher: ProxyFetcher;

const makers = new Map<string, Maker>();

async function downloadFile(url: string, dirname: string, filename: string) {
	remainingCount++;
	const path = `${dirname}/${filename}`;
	console.log(`Downloading ${url} to ${path}. ${remainingCount} tasks left.`);
	while (true) {
		try {
			const stream: ReadStream = (await fetcher.getWithProxy(url, {
				responseType: "stream",
				...config.customFetchOptions
			})).data;
			await new Promise(async (resolve, reject) => {
				stream.pipe(fs.createWriteStream(path));
				stream.on("close", resolve);
				stream.on("error", reject);
			});
			remainingCount--;
			console.log(`Downloaded ${url} to ${path}. ${remainingCount} tasks left.`);
			return;
		} catch (e) {
			console.log(`Failed downloading ${url} to ${path}. Trying again.`);
		}
	}
}

interface DownloadTask {
	url: string,
	dirname: string,
	filename: string
}

async function downloadRelatedFiles(apiData: SongAPIData, dbData: SongDBData) {
	const dirname = `${songPath}/${dbData.id}`
	const urlPrefix = `${config.song_baseurl}/${apiData.id}`;
	let downloadTasks: DownloadTask[] = [
		{
			url: `${urlPrefix}/main.${config.song_type}`,
			dirname,
			filename: `main.${config.song_type}`
		}
	];

	try { 
		await fs.promises.access(dirname);
	} catch (e) {
		await fs.promises.mkdir(dirname, {
			recursive: true
		});
	}
	if (dbData.type === "tja") {
		downloadTasks.push({
			url: `${urlPrefix}/main.tja`,
			dirname,
			filename: `main.tja`
		});
	} else {
		for (let diff of ["easy", "normal", "hard", "oni", "ura"].filter(diff => dbData.courses[diff] != null)) {
			downloadTasks.push({
				url: `${urlPrefix}/${diff}.osu`,
				dirname,
				filename: `${diff}.osu`
			});
		}
	}
	await Promise.all(downloadTasks.map(dl => downloadFile(dl.url, dl.dirname, dl.filename)));
}

function handleMaker(maker: Maker): number {
	if (!maker) {
		return null;
	}
	if (makers.has(maker.name)) {
		return makers.get(maker.name).id;
	}
	const newMakerID = config.random_song_id ? Math.floor(Math.random() * 100000000) : maker.id;
	makers.set(maker.name, {
		id: newMakerID,
		name: maker.name,
		url: maker.url
	});
	return newMakerID;
}

async function handleSongData(data: SongAPIData): Promise<SongDBData> {
	if (_.any(existingSongs, oldData => data.title === oldData.title)) {
		console.log(`Song ${data.title} exists. Skipping.`);
		return null;
	}
	console.log(`Handling song ${data.title}.`);
	const newSongID = config.random_song_id ? Math.floor(Math.random() * 100000000) : data.id;
	const ret: SongDBData = {
		"skin_id": null,
		"title": data.title,
		"category_id": data.category_id,
		"enabled": true,
		"type": data.type,
		"courses": data.courses,
		"volume": data.volume,
		"id": newSongID,
		"preview": data.preview,
		"order": newSongID,
		"title_lang": data.title_lang,
		"hash": data.hash,
		"offset": data.offset,
		"maker_id": handleMaker(data.maker),
		"subtitle": data.subtitle,
		"subtitle_lang": data.subtitle_lang,
		"lyrics": false
	}
	await downloadRelatedFiles(data, ret);
	return ret;
}

async function main() {
	console.log("Started.");
	config = await loadJSON("./config.json");
	fetcher = new ProxyFetcher(config.proxy);
	songPath = `${config.output}/songs`;
	try { 
		await fs.promises.access(songPath);
	} catch (e) {
		await fs.promises.mkdir(songPath, {
			recursive: true
		});
	}
	if (config.old_db_file) {
		console.log(`Loading existing song data.`);
		try {
			existingSongs = await loadJSON(config.old_db_file);
		} catch (e) {
			console.error(`Load existing song data failed.`);
		}
	}
	if (config.proxy.useProxy) {
		console.log(`Loading proxies...`);
		await fetcher.initProxies();
	}
	console.log(`Fetching song list from ${config.song_api}.`);
	const originalSongs: SongAPIData[] = (await fetcher.getWithProxy(config.song_api, {
		responseType: "json",
		...config.customFetchOptions
	})).data;
	console.log(`${originalSongs.length} songs fetched.`);
	const handledSongs = (await Promise.all(originalSongs.map(handleSongData))).filter(m => m != null);
	await Promise.all([
		fs.promises.writeFile(`${config.output}/songs.json`, JSON.stringify(handledSongs)),
		fs.promises.writeFile(`${config.output}/makers.json`, JSON.stringify(Array.from(makers.values()))),
	])
}
main();
