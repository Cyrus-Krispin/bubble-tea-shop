import { createServer } from "node:http";

const port = Number.parseInt(process.env.PORT ?? "4173", 10);
const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:8080";

const server = createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "UP" }));
    return;
  }

  if (request.url === "/") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        message: "Bubble Tea Shop frontend workspace is running; product UI is not implemented yet.",
        apiBaseUrl,
      }),
    );
    return;
  }

  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: "Not found" }));
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Frontend placeholder listening on port ${port}`);
});
