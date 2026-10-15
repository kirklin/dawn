<p align="center">
  <img src=".github/assets/banner.png?v=2" alt="twilit.cc, with three phones showing New York at midday, in the sunset glow and at night" width="100%">
</p>

# twilit.cc

**Sunrise and sunset glow forecast for the next four days.**

twilit.cc is a mobile web app that tells you whether the next sunrise or sunset will light up the clouds. It reads the ECMWF and GFS cloud forecasts at eight points toward the sun, out to 400 km, adds the CAMS aerosol forecast, and rates each event from 不烧 (none) to 超级大烧 (epic). Behind every page is the sky it forecasts, rendered in WebGL from the same data, with the clouds drifting on the forecast winds. Drag the sun along its path and the sky follows it through the day. The interface is in Chinese. On an iPhone it runs full screen once added to the Home Screen.

## 产品灵感

几年前的一个傍晚，Ruby 抬头时才发现，自己又一次错过了那场难得的晚霞。后来，她在小红书上偶然搜到了 [sunsetbot.top](https://sunsetbot.top/) 这个小程序。

那时她才意识到，原来真的有人在认真地为日出、日落与晚霞做一件专门的事：把稍纵即逝的天空记录下来，也把观看天空变成一种可以被期待的体验。

后来，sunsetbot 停服了。在 Ruby 的日出日落晚霞投稿群里，马老师问：“sunsetbot 小程序没用了吗？”这句话让 Ruby 再次想起了它，也让一个念头逐渐清晰起来——或许可以和好朋友 Kirk 一起，让这件事重新开始。

于是，twilit.cc 诞生了。Kirk 负责主要代码与界面设计，Ruby 负责产品想法以及社群用户反馈的收集。它不只是对一个旧产品的延续，也是两个人对日出、日落与晚霞这件小事的重新回答。

![sunsetbot.top 截图](.github/assets/sunsetbot-origin.png)

<p align="center"><sub>sunsetbot.top 曾经的界面与晚霞分析记录。</sub></p>

我们想重新做的，不只是一个晚霞预测工具，
也是一种重新抬头看天空的方式。
每一次日出与日落都短暂而具体，但它们同样值得被记录、被等待。

![Pale Blue Dot inspiration](.github/assets/pale-blue-dot-inspiration.jpg)

<p align="center"><sub>“我们都生活在这颗微小而脆弱的蓝点上。”
  这也是 twilit.cc 想守护的观看方式：
  从日常的天空出发，重新感受我们所在的世界。</sub></p>

<p align="center">
  <img src=".github/assets/screens.png" alt="New York at midday and in the sunset glow, and the cards further down the page" width="100%">
</p>
<p align="center"><sub>New York at midday and in tonight's sunset glow, then the cards further down: the glow forecast, what makes it, golden and blue hour, and the moon. All live forecasts, captured in the iOS Simulator.</sub></p>

## How the forecast works

Each place gets eight points along the azimuth of its sunrise and sunset, at 0, 25, 50, 100, 150, 200, 300 and 400 km. For every event, the low, mid and high cloud cover of ECMWF IFS and NCEP GFS at those points goes into five factors, scored for each model separately:

- mid and high cloud near you, which the low sun lights from below
- low cloud along the path, and the far end of a mid deck, which block that light on its way in
- local low cloud that hides the sky
- aerosol optical depth from CAMS
- rain at the place

The two scores are averaged, and the bar beside each event spans both, so its length shows how far the models agree. Sunrise and sunset, golden and blue hour, moonrise, moonset and the phase of the moon come from astronomy-engine.

## The sky

The sky shows the present, or any moment from two hours before sunrise to two hours after sunset that you drag the sun to. Tapping a sunrise or sunset in the forecast jumps to three minutes after sunset, or before sunrise, when the glow is at its best. The atmosphere is single scattering through Rayleigh, Mie and ozone layers over a round Earth, traced on a coarse grid whenever the moment changes. Three cloud layers are drawn every frame from a tiling noise texture: cloudlets gathered into masses for low and mid cloud, and bands of fine strands for cirrus. They are cut to the forecast cover at each distance, lit from their sunward side, and carried by the 850, 600 and 300 hPa winds. The view faces the low sun at sunrise and sunset and turns its back on it once it has climbed; after dusk the stars come out. With reduced motion turned on, the clouds stay still.

## Development

```bash
pnpm install
pnpm dev
```

```bash
pnpm typecheck && pnpm lint && pnpm test --run && pnpm build
```

## Data

Weather data by [Open-Meteo](https://open-meteo.com) (ECMWF IFS, NCEP GFS and CAMS), licensed under CC BY 4.0. Place search by [Photon](https://photon.komoot.io) and Open-Meteo geocoding, and the name of your location by [Nominatim](https://nominatim.org) under the [OSMF usage policy](https://operations.osmfoundation.org/policies/nominatim/); map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.

## Product feedback and viewpoint data

- [User feedback, product recommendations and city viewpoint catalog (Markdown)](docs/product/feedback/README.md) · [HTML report](docs/product/feedback/index.html)
- [Structured viewpoint catalog (JSON)](data/viewpoints/catalog.json) and [CSV](data/viewpoints/catalog.csv)
- [Viewpoint data notes and verification limits](data/viewpoints/README.md)
