import * as cheerio from "cheerio";
import axios from "axios";

const SCREENER_URL =
  "https://www.screener.in/screens/57601/coffee-can-portfolio/";
const headers = [];
const file = Bun.file("output.csv");
const writer = file.writer();

function writeCSV(rowdata) {
  let row = rowdata.join(",");
  console.log(row);
  writer.write(row + "\n");
}

async function getHtml(URL) {
  const { data: html } = await axios.get(URL);
  return html;
}

getHtml(SCREENER_URL).then((res) => {
  const $ = cheerio.load(res);
  const $table = $(".data-table > tbody");
  $table.find("tr:nth-child(1) > th").each((_idx, element) => {
    headers.push($(element).text().replace(/\n\s+/g, " ").trim());
  });
  writeCSV(headers);
  $table.find("tr[data-row-company-id]").each((_idx, element) => {
    let data = [];
    $(element)
      .find("td")
      .each((_idx, element) => {
        data.push($(element).text().trim());
      });
    writeCSV(data);
  });
  writer.flush();
  writer.end();
});
