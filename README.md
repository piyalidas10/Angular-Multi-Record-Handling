# Angular-Multi-Record-Handling
Angular enterprise applications handling 10K–100K+ records

```
How would you handle 1000+ records in a dropdown?

I would avoid rendering all records in the UI. I would use an autocomplete/typeahead component with backend filtering and pagination. On the Angular side I would use debounceTime, OnPush change detection, trackBy, caching, and CDK Virtual Scroll if a large list must be displayed. This reduces DOM rendering, memory usage, network traffic, and change detection overhead, keeping the UI responsive even with tens of thousands of records.
```
This is the approach typically used in large Angular enterprise applications handling 10K–100K+ records.

## Run Application
```
docker compose up -d --build
```

Whenever you modify Angular or Nodejs code:
```
docker compose down
docker compose build --no-cache
docker compose up -d
```

