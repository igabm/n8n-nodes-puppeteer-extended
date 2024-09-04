import {
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	IExecuteFunctions,
} from "n8n-workflow";
import { KnownDevices } from "puppeteer";
import { nodeDescription } from "./Puppeteer.node.options";
import { ipcRequest } from "./puppeteer/helpers";
import server from "./puppeteer";

// we start the server if we are in the main process
if (!process.send) server();

export class Puppeteer implements INodeType {
	description: INodeTypeDescription = nodeDescription;

	methods = {
		loadOptions: {
			async getDevices(
				this: ILoadOptionsFunctions
			): Promise<INodePropertyOptions[]> {
				const returnData: INodePropertyOptions[] = [];

				for (const [name, device] of Object.entries(KnownDevices)) {
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
			console.log("Throw error", e);
			throw new Error(e);
		});

		console.log("[PuppeteerNode] Launch", isStarted);

		if (isStarted) {
			console.log("exec", globalOptions);
			let messageBuffer = "";
			let totalChunks = 0;
			let receivedChunks = 0;

			// Execute puppeteer interactions
			const res = await new Promise((resolve, reject) => {
				// Initiate the IPC request
				(0, helpers_1.ipcRequest)("exec", {
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
					reject(new Error(e));
				});

				// Listen for chunked responses
				node_ipc_1.default.client.on("exec_chunk", (data) => {
					messageBuffer += data.chunk;
					receivedChunks += 1;

					// Check if all chunks have been received
					if (receivedChunks === data.totalChunks) {
						resolve(JSON.parse(messageBuffer)); // Resolve the promise with the reconstructed message
					}
				});

				// Listen for errors
				node_ipc_1.default.client.on("exec_complete", (message) => {
					console.log(message); // "Data transmission complete"
				});

				node_ipc_1.default.client.on("exec_error", (error) => {
					reject(new Error(error)); // Handle errors
				});
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
								bufferData = Buffer.from(binaryDataValue);
							} else if (binaryDataValue instanceof ArrayBuffer) {
								bufferData = Buffer.from(new Uint8Array(binaryDataValue));
							} else if (binaryDataValue instanceof Uint8Array) {
								// If it's already a Uint8Array, convert directly
								bufferData = Buffer.from(binaryDataValue);
							} else if (
								binaryDataValue instanceof Object &&
								binaryDataValue.data
							) {
								// If it's an object with a "data" field (which is Uint8Array or similar), handle conversion
								bufferData = Buffer.from(new Uint8Array(binaryDataValue.data));
							} else if (Buffer.isBuffer(binaryDataValue)) {
								bufferData = binaryDataValue;
							} else if (
								typeof binaryDataValue === "object" &&
								binaryDataValue !== null
							) {
								// Handle objects safely
								console.error(
									`Received an object instead of binary data for key: ${key}. Make sure the data is properly formatted.`
								);
								continue; // Skip this entry if the data type is invalid
							} else {
								console.error(
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
								.catch((e) => console.log(e));

							if (binaryData) {
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
