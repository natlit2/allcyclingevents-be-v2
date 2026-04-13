const puppeteer = require("puppeteer");
const Event = require("../models/eventModel");
//const connectDB = require("../dbinit");
//const moment = require("moment");

async function scrapeEvent(url) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  try {
    await page.goto(url);
  } catch (err) {
    console.log(`Oooops...there was an Error on the main events page: ${err}`);
  }

  //////scrape the link to the event

  // // to get all links on the page
  // const selector = "a.item-link";
  // const eventLinks = await page.$$eval(selector, (am) =>
  //   am.filter((e) => e.href).map((e) => e.href)
  // );
  //console.log(`ALL LINKS: ${eventLinks}`);

  ////to get 1 specific link
  const selector = "a.item-link";
  const eventLink = await page.$eval(selector, (el) => el.href);
  console.log(`the event link is: ${eventLink}`);

  //for await (const eventLink of eventLinks) {
  //console.log(`THIS IS THE EVENT LINK: ${eventLink}`);
  const eventPage = await browser.newPage();
  try {
    await eventPage.goto(eventLink);

    //scrape the image link
    const imglinkSelector = "#content > div.item-page > figure > img";
    const imgLink = await eventPage.$eval(imglinkSelector, (el) => el.src);
    console.log(`IMAGE LINK IS: ${imgLink}`);

    //scrape the title
    const [titleElement] = await page.$x(
      '//*[@id="content"]/div[4]/div[1]/a/h2'
    );

    const txt = await titleElement.getProperty("textContent");
    const eventTitle = await txt.jsonValue();

    console.log(`the event title is: ${eventTitle}`);

    //Split the title
    const destructuredTitleArr = eventTitle.split(" am ");
    console.log(`the destructured title is: ${destructuredTitleArr}`);

    //extract the date from the title
    //take the last item in the array(the date) save to a variable and pass it to the date formater
    const eventDate = destructuredTitleArr[1];
    console.log(eventDate);

    // const formatedDate = moment().format(rawDate);
    // console.log(formatedDate);

    //format the date

    const formatDate = (str) => {
      const toArr = str.split(" ");
      let month;
      switch (toArr[1]) {
        case "Januar":
          month = "01";
          break;
        case "Februar":
          month = "02";
          break;
        case "März":
          month = "03";
          break;
        case "April":
          month = "04";
          break;
        case "Mai":
          month = "05";
          break;
        case "Juni":
          month = "06";
          break;
        case "Juli":
          month = "07";
          break;
        case "August":
          month = "08";
          break;
        case "September":
          month = "09";
          break;
        case "Oktober":
          month = "10";
          break;
        case "November":
          month = "11";
          break;
        case "Dezember":
          month = "12";
          break;
        default:
          break;
      }
      return `${toArr[2]}-${month}-${toArr[0].replace(".", "")}`;
    };

    const startDate = new Date(
      eventDate.includes("–")
        ? formatDate(eventDate.substring(0, eventDate.indexOf("–")))
        : formatDate(eventDate)
    );

    const endDate = new Date(
      eventDate.includes("–")
        ? formatDate(
            eventDate
              .substring(eventDate.indexOf("–") + 1, eventDate.length)
              .trim()
          )
        : new Date(startDate).setHours(startDate.getHours() + 2)
    );

    console.log("start:", startDate);
    console.log("end:", endDate);

    // check if there is an event already in the DB title && date
    const found = await Event.findOne({ title: eventTitle, start: startDate });
    if (found) return console.log("Event already exists");

    const newEvent = await Event.create({
      title: eventTitle,
      start: startDate,
      end: endDate,
      link: eventLink,
      imgLink: imgLink,
      city: "Berlin",
    });
    console.log(`New event created with id ${newEvent._id}`);
  } catch (err) {
    console.log(`Oooops...there was an Error on the event page: ${err}`);
  }
  browser.close();
  return;
}
scrapeEvent("http://adfc-berlin.de/aktiv-werden/bei-demonstrationen.html");
