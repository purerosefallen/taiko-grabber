import axios, { AxiosProxyConfig, AxiosRequestConfig } from "axios";

//const proxySourceList = [
//	"http://www.89ip.cn/tqdl.html?api=1&num=9999", "http://www.66ip.cn/mo.php?tqsl=9999"
//]

//for (let i = 1; i <= 2000; ++i) {
//	proxySourceList.push(`http://www.xiladaili.com/http/${i}`);
//}

export interface ProxyConfig {
	useProxy: boolean,
	proxySource: string[],
	timeout: number
}

const agentList = [
	'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; en-us) AppleWebKit/534.50 (KHTML, like Gecko) Version/5.1 Safari/534.50',
	'Mozilla/5.0 (Windows; U; Windows NT 6.1; en-us) AppleWebKit/534.50 (KHTML, like Gecko) Version/5.1 Safari/534.50',
	'Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; Trident/5.0',
	'Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.0; Trident/4.0)',
	'Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0)',
	'Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1)',
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.6; rv:2.0.1) Gecko/20100101 Firefox/4.0.1',
	'Mozilla/5.0 (Windows NT 6.1; rv:2.0.1) Gecko/20100101 Firefox/4.0.1',
	'Opera/9.80 (Macintosh; Intel Mac OS X 10.6.8; U; en) Presto/2.8.131 Version/11.11',
	'Opera/9.80 (Windows NT 6.1; U; en) Presto/2.8.131 Version/11.11',
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_7_0) AppleWebKit/535.11 (KHTML, like Gecko) Chrome/17.0.963.56 Safari/535.11',
	'Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 5.1; Maxthon 2.0)',
	'Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 5.1; TencentTraveler 4.0)',
	'Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 5.1)',
	'Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 5.1; The World)',
	'Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 5.1; Trident/4.0; SE 2.X MetaSr 1.0; SE 2.X MetaSr 1.0; .NET CLR 2.0.50727; SE 2.X MetaSr 1.0)',
	'Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 5.1)'
]

async function testProxy(proxy: AxiosProxyConfig) {
	await axios.get("http://mirrors.aliyun.com/debian/pool", {
		proxy,
		headers: {
			"User-Agent": agentList[4]
		},
		timeout: this.config.timeout,
	});
	return proxy;
}

async function checkProxy(proxy: AxiosProxyConfig) {
	let isProxyUsable = false;
	try {
		await testProxy(proxy);
		//console.log(`Proxy ${proxy.host} is ok.`);
		isProxyUsable = true;
	} catch (e) {
		//console.error(`Proxy ${proxy.host} is broken: ${e.toString()}`);
	}
	return isProxyUsable;
}

async function filterProxies(proxies: AxiosProxyConfig[]) {
	const proxiesUsableList = await Promise.all(proxies.map(checkProxy));
	return proxies.filter((proxy, index) => {
		return proxiesUsableList[index];
	});
}

//async function findFirstUsableProxy(proxies: AxiosProxyConfig[]) {
//	return [await Promise.any(proxies.map(testProxy))];
//}

export class ProxyFetcher {
	proxies: AxiosProxyConfig[];
	counter: number;
	config: ProxyConfig;
	constructor(config: ProxyConfig) {
		this.config = config;
		this.proxies = [];
		this.counter = 0;
	}
	async initProxiesFrom(url: string) {
		if (!this.config.useProxy) {
			return;
		}
		console.log(`Fetching proxies from ${url}.`)
		while (true) {
			try {
				const proxyPage: string = (await axios.get(url, {
					responseType: "document",
				})).data;
				const proxies: AxiosProxyConfig[] = proxyPage.match(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d{1,5}/g).map(proxyString => {
					const [host, _port] = proxyString.split(":");
					const port = parseInt(_port);
					const proxy = { host, port };
					return proxy;
				});
				//const usableProxies = await filterProxies(proxies);
				for (let proxy of proxies) {
					this.proxies.push(proxy);
				}
				console.error(`Got ${proxies.length} proxies from ${url}.`);
				return;
			} catch (e) {
				console.error(`Failed fetching proxy list from ${url}: ${e.toString()}`)
			}
		}
	}
	async initProxies() {
		await Promise.all(this.config.proxySource.map((m) => {
			return this.initProxiesFrom(m);
		}));
	}
	async getWithProxy(url: string, options: AxiosRequestConfig) {
		while (true) {
			if (this.config.useProxy && !this.proxies.length) {
				await this.initProxies();
			}
			const proxyIndex = !this.config.useProxy ? null : (++this.counter) % this.proxies.length;
			//const proxyIndex = 0;
			const proxy = !this.config.useProxy ? null : this.proxies[proxyIndex];
			try {
				const data = (await axios.get(url, {
					proxy,
					headers: {
						"User-Agent": agentList[this.counter % agentList.length]
					},
					timeout: this.config.timeout,
					...options
				}));
				return data;
			} catch (e) {
				if (this.config.useProxy) {
					this.proxies.splice(proxyIndex, 1);
				}
				console.error(`Failed fetching data from ${url}: ${e.toString()} ${this.proxies.length} proxies left.`)
			}
		}
	}
}
