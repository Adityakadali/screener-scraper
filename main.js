// Import necessary modules
import * as cheerio from "cheerio";
import axios from "axios";
import fs from "fs/promises";
import * as p from "@clack/prompts";

// Get user input using prompts
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
});

// Set the delay between HTTP requests
const requestDelay = 2000;

// Function to fetch HTML content from a URL
async function getHtml(URL) {
  try {
    const { data: html } = await axios.get(URL);
    return html;
  } catch (error) {
    throw new Error(`Failed to fetch HTML from ${URL}: ${error.message}`);
  }
}

// Function to extract and write headers to a CSV file
async function getHeaders(URL) {
  try {
    const html = await getHtml(URL);
    const $ = cheerio.load(html);
    const headers = [];
    const $table = $(".data-table > tbody");

    // Extract headers from the first row of the table
    $table.find("tr:nth-child(1) > th").each((_idx, element) => {
      headers.push($(element).text().replace(/\n\s+/g, " ").trim());
    });

    // Write headers to the CSV file
    await writeCSV(headers, userInput.outputFilePath + ".csv");

    // Determine the total number of pages for pagination
    const totalPages =
      $("[data-paging] > div > div > a.ink-900").last().text() || "1";
    console.log(`Total pages: ${totalPages}`);
    return totalPages;
  } catch (error) {
    throw new Error(`Error while getting headers: ${error.message}`);
  }
}

// Function to write data to a CSV file
async function writeCSV(data, filePath) {
  try {
    const row = data.join(",");
    await fs.appendFile(filePath, row + "\n");
  } catch (error) {
    throw new Error(`Error while writing to CSV: ${error.message}`);
  }
}

// Function to process data from each page
async function processPage(URL, page) {
  const pageUrl = `${URL}?page=${page}`;
  const html = await getHtml(pageUrl);
  const $ = cheerio.load(html);
  const $table = $(".data-table > tbody");

  // Extract and write data from each row on the page
  $table.find("tr[data-row-company-id]").each((_idx, element) => {
    const data = $(element)
      .find("td")
      .map((_idx, element) => $(element).text().trim())
      .get();

    writeCSV(data, userInput.outputFilePath + ".csv");
  });
}

// Function to generate the CSV file
async function makeCSV(URL) {
  try {
    const totalPages = await getHeaders(URL);

    // Process data from each page
    for (let index = 1; index <= totalPages; index++) {
      console.log(`Processing page ${index} of ${totalPages}`);
      await processPage(URL, index);

      // Introduce a delay between requests to avoid overloading the server
      await new Promise((resolve) => setTimeout(resolve, requestDelay));
    }

    console.log("CSV generation complete.");
  } catch (error) {
    console.error(error.message);
  }
}

// Main function to orchestrate the process
async function main() {
  try {
    // Create or clear the output CSV file
    await fs.writeFile(userInput.outputFilePath + ".csv", "");

    // Start generating the CSV file
    await makeCSV(userInput.SCREENER_URL);
  } catch (error) {
    console.error(error.message);
  }
}

// Execute the main function
main();
