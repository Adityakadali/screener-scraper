import * as cheerio from "cheerio";
import axios from "axios";
import fs from "fs/promises"; // Import the 'fs/promises' module for file operations.
import * as p from "@clack/prompts";

const userInput = await p.group({
  SCREENER_URL: () =>
    p.text({
      message: "Enter URL of the Screen",
      placeholder: "https://www.screener.in/screens/example",
      validate: (value) => {
        const urlPattern =
          /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;
        if (!urlPattern.test(value)) return "Please enter a valid URL.";
      },
    }),
  outputFilePath: () =>
    p.text({
      message: "Enter output file name",
      placeholder: "outputscreen",
      validate: (value) => {
        const fileNamePattern = /^[a-zA-Z0-9-_]+(\.[a-zA-Z0-9]+)?$/;
        if (!fileNamePattern.test(value)) return "Please valid file name.";
      },
    }),
}); // Specify the output file path.
const headers = [];
let totalPages;
const requestDelay = 2000;

async function getHtml(URL) {
  try {
    const { data: html } = await axios.get(URL);
    return html;
  } catch (error) {
    throw new Error(`Failed to fetch HTML from ${URL}: ${error.message}`);
  }
}

async function getHeaders(URL) {
  try {
    const html = await getHtml(URL);
    const $ = cheerio.load(html);
    const $table = $(".data-table > tbody");
    $table.find("tr:nth-child(1) > th").each((_idx, element) => {
      headers.push($(element).text().replace(/\n\s+/g, " ").trim());
    });
    await writeCSV(headers);
    totalPages =
      $("[data-paging] > div > div > a.ink-900").last().text() || "1";
    console.log(`Total pages: ${totalPages}`);
  } catch (error) {
    throw new Error(`Error while getting headers: ${error.message}`);
  }
}

async function writeCSV(data) {
  try {
    const row = data.join(",");
    await fs.appendFile(userInput.outputFilePath + ".csv", row + "\n");
  } catch (error) {
    throw new Error(`Error while writing to CSV: ${error.message}`);
  }
}

async function makeCSV(URL) {
  try {
    await getHeaders(URL);
    for (let index = 1; index <= totalPages; index++) {
      console.log(`Processing page ${index} of ${totalPages}`);
      const pageUrl = `${URL}?page=${index}`;
      const html = await getHtml(pageUrl);
      const $ = cheerio.load(html);
      const $table = $(".data-table > tbody");
      $table.find("tr[data-row-company-id]").each((_idx, element) => {
        const data = [];
        $(element)
          .find("td")
          .each((_idx, element) => {
            data.push($(element).text().trim());
          });
        writeCSV(data);
      });
      await new Promise((resolve) => setTimeout(resolve, requestDelay));
    }
    console.log("CSV generation complete.");
  } catch (error) {
    console.error(error.message);
  }
}

async function main() {
  try {
    console.log(userInput);
    // Clear the output file if it exists or create a new one.
    await fs.writeFile(userInput.outputFilePath + ".csv", "");
    await makeCSV(userInput.SCREENER_URL);
  } catch (error) {
    console.error(error.message);
  }
}

main();
