# MP3 Proposal

**What I'm building:** A trip weather planner that lets you compare current conditions and short term forecasts across multiple cities so you can decide where and when to go.

**Which API I'm using:** Open-Meteo (https://open-meteo.com), specifically the Forecast API and the Geocoding API to turn a city name into coordinates.

**Why I chose this:** I like the idea of building something I would actually use. I travel back and forth between Boston and Mumbai and I'm always comparing weather across a few cities when I'm figuring out timing for a trip or deciding between destinations. This API also has no key requirement, which means I can deploy straight to GitHub Pages without worrying about hiding credentials.

**Core features:**
1. Search a city by name and add it to a comparison list (using the Geocoding API to resolve name to lat/long, then the Forecast API for the data)
2. Show current conditions plus a 3 day forecast for each added city as a card, including temperature, precipitation chance, and a simple weather icon or label
3. Let the user toggle between Celsius and Fahrenheit
4. Compare cities side by side so the user can see which one has the best conditions right now
5. Save the user's list of cities with localStorage so it persists between visits

**What I don't know yet:** I haven't worked with an API that needs two calls chained together before, first geocoding the city name, then using that result to call the forecast endpoint. I'm not sure yet how to handle multiple simultaneous fetch calls cleanly when the user adds several cities at once, I think this is where Promise.all comes in but I need to look into it. I'm also not fully sure how Open-Meteo structures its hourly versus daily data arrays yet, so I want to console.log the raw response before I build anything on top of it.