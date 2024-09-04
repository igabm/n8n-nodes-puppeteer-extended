"use strict";
var __asyncValues =
	(this && this.__asyncValues) ||
	function (o) {
		if (!Symbol.asyncIterator)
			throw new TypeError("Symbol.asyncIterator is not defined.");
		var m = o[Symbol.asyncIterator],
			i;
		return m
			? m.call(o)
			: ((o =
					typeof __values === "function" ? __values(o) : o[Symbol.iterator]()),
			  (i = {}),
			  verb("next"),
			  verb("throw"),
			  verb("return"),
			  (i[Symbol.asyncIterator] = function () {
					return this;
			  }),
			  i);
		function verb(n) {
			i[n] =
				o[n] &&
				function (v) {
					return new Promise(function (resolve, reject) {
						(v = o[n](v)), settle(resolve, reject, v.done, v.value);
					});
				};
		}
		function settle(resolve, reject, d, v) {
			Promise.resolve(v).then(function (v) {
				resolve({ value: v, done: d });
			}, reject);
		}
	};
var __importDefault =
	(this && this.__importDefault) ||
	function (mod) {
		return mod && mod.__esModule ? mod : { default: mod };
	};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Puppeteer = void 0;
const puppeteer_1 = require("puppeteer");
const Puppeteer_node_options_1 = require("./Puppeteer.node.options");
const helpers_1 = require("./puppeteer/helpers");
const puppeteer_2 = __importDefault(require("./puppeteer"));
if (!process.send) (0, puppeteer_2.default)();
class Puppeteer {
	constructor() {
		this.description = Puppeteer_node_options_1.nodeDescription;
		this.methods = {
			loadOptions: {
				async getDevices() {
					const returnData = [];
					for (const [name, device] of Object.entries(
						puppeteer_1.KnownDevices
					)) {
						returnData.push({
							name,
							value: name,
							description: `${device.viewport.width} x ${device.viewport.height} @ ${device.viewport.deviceScaleFactor}x`,
						});
					}
					return returnData;
				},
			},
		};
	}
	async execute() {
		var _a, e_1, _b, _c;
		let returnData = [];
		const credentials = await this.getCredentials("n8nApi");
		const executionId = this.getExecutionId();
		const globalOptions = this.getNodeParameter("globalOptions", 0, {
			headless: "new",
			launchArguments: { args: [{ arg: "--no-sandbox" }] },
			stealth: true,
		});
		const nodeOptions = this.getNodeParameter("nodeOptions", 0, {});
		const url = this.getNodeParameter("url", 0, {});
		const queryParameters = this.getNodeParameter("queryParameters", 0, {});
		const interactions = this.getNodeParameter("interactions", 0, {});
		const output = this.getNodeParameter("output", 0, {});

		console.log("[PuppeteerNode] Launch");

		// Launch puppeteer process
		const isStarted = await (0, helpers_1.ipcRequest)("launch", {
			globalOptions,
			executionId,
		}).catch((e) => {
			console.log(`Error during Puppeteer launch: ${e.name}`);
			throw new Error(e);
		});

		console.log("[PuppeteerNode] Launch", isStarted);

		if (isStarted) {
			console.log("exec", globalOptions);

			// Execute puppeteer interactions
			const res = await (0, helpers_1.ipcRequest)("exec", {
				nodeParameters: {
					globalOptions,
					nodeOptions,
					url,
					queryParameters,
					interactions,
					output,
				},
				executionId,
				continueOnFail: this.continueOnFail(),
			}).catch((e) => {
				console.log(`Error during Puppeteer exec: ${e.name}`);
				throw new Error(e);
			});

			if (res) {
				if (res.binary) {
					try {
						for (
							var _d = true, _e = __asyncValues(Object.keys(res.binary)), _f;
							(_f = await _e.next()), (_a = _f.done), !_a;
							_d = true
						) {
							_c = _f.value;
							_d = false;
							const key = _c;
							const type = res.binary[key].type;
							const binaryDataValue = res.binary[key].data;

							// Ensure binaryDataValue is valid for Buffer.from
							let bufferData;
							if (
								typeof binaryDataValue === "string" ||
								Array.isArray(binaryDataValue)
							) {
								console.log("string or array");
								bufferData = Buffer.from(binaryDataValue);
							} else if (binaryDataValue instanceof ArrayBuffer) {
								console.log("arraybuffer");
								bufferData = Buffer.from(new Uint8Array(binaryDataValue));
							} else if (binaryDataValue instanceof Uint8Array) {
								// If it's already a Uint8Array, convert directly
								console.log("uint8array");
								bufferData = Buffer.from(binaryDataValue);
							} else if (
								binaryDataValue instanceof Object &&
								binaryDataValue.data
							) {
								// If it's an object with a "data" field (which is Uint8Array or similar), handle conversion
								console.log("data from object");
								bufferData = Buffer.from(new Uint8Array(binaryDataValue.data));
							} else if (Buffer.isBuffer(binaryDataValue)) {
								console.log("buffer");
								bufferData = binaryDataValue;
							} else if (
								typeof binaryDataValue === "object" &&
								binaryDataValue !== null
							) {
								console.log("object");
								// Convert the object to an ordered array based on keys
								const orderedArray = Object.keys(binaryDataValue)
								  .sort((a, b) => a - b) // Sort the keys numerically
								  .map(key => binaryDataValue[key]); // Convert the values into an array
								
								// Create a Buffer from the ordered array
								bufferData = Buffer.from(new Uint8Array(orderedArray));
							} else {
								console.log(
									`Invalid data type for Buffer.from: ${typeof binaryDataValue}`
								);
								continue; // Skip this iteration if the data type is invalid
							}

							// Prepare binary data for output
							const binaryData = await this.helpers
								.prepareBinaryData(
									bufferData,
									undefined,
									type === "pdf"
										? "application/pdf"
										: `image/${res.binary[key].type}`
								)
								.catch((e) =>
									console.log(`Error during binary data preparation: ${e.name}`)
								);

							if (binaryData) {
								// prevent event on res by using another object to store the binary data
								res.binary[key] = binaryData;
							} else {
								delete res.binary[key];
							}
						}
					} catch (e_1_1) {
						e_1 = { error: e_1_1 };
					} finally {
						try {
							if (!_d && !_a && (_b = _e.return)) await _b.call(_e);
						} finally {
							if (e_1) throw e_1.error;
						}
					}
				}
				returnData = [res];
			}
		}

		// Send a request to "check"
		(0, helpers_1.ipcRequest)("check", {
			executionId,
			apiKey: credentials.apiKey,
			baseUrl: credentials.baseUrl,
		});

		return this.prepareOutputData(returnData);
	}
}
exports.Puppeteer = Puppeteer;
//# sourceMappingURL=Puppeteer.node.js.map
