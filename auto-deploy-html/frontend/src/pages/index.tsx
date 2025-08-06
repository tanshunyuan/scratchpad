import { HtmlSandbox } from "@/components/html-sandbox";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useMutation } from "@tanstack/react-query";
import { isEmpty } from "lodash-es";
import { useState } from "react";
import axios from "axios";

const SAMPLE_HTML = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Simple HTML + CSS + JS Demo</title>

    <!-- 1. CSS -->
    <style>
      body {
        margin: 0;
        font-family: Arial, sans-serif;
        background-color: #f2f9ff;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
      }
      h1   { color: #005bbb; }
      p    { color: #444; margin: 0 0 1rem; }
      button {
        padding: 0.6rem 1.2rem;
        border: none;
        border-radius: 4px;
        background: #005bbb;
        color: #fff;
        cursor: pointer;
        transition: background 0.25s;
      }
      button:hover { background: #003d82; }
    </style>
  </head>

  <body>
    <h1>Hello, world!</h1>
    <p id="msg">Click the button to change this text.</p>
    <button onclick="changeMessage()">Click me</button>

    <!-- 2. JavaScript -->
    <script>
      function changeMessage() {
        const messages = [
          "CSS styled ✔",
          "JavaScript running ✔",
          "Have a nice day!"
        ];
        const p = document.getElementById('msg');
        p.textContent = messages[Math.floor(Math.random() * messages.length)];
      }
    </script>
  </body>
  </html>
  `;

export default function Home() {
  const [htmlStr, setHtmlStr] = useState<string>(SAMPLE_HTML);
  const [siteUrl, setSiteUrl] = useState<string | null>(null);

  const deploy = useMutation({
    mutationFn: (payload: { html: string }) =>
      axios
        .post<{ siteUrl: string }>("/api/deployments/create", payload)
        .then((r) => r.data),
    onSuccess(data) {
      setSiteUrl(data.siteUrl);
      // // 3. open SSE channel
      // const es = new EventSource(`/api/deploy-events/${userId}`);
      // es.onmessage = (e) => {
      //   const { deployUrl } = JSON.parse(e.data);
      //   setLiveUrl(deployUrl);
      //   refetch();
      //   es.close();
      // };
    },
  });

  return (
    <main className={`flex flex-col min-h-screen h-full p-8`}>
      {!isEmpty(siteUrl) ? (
        <Button variant={"link"} asChild>
          <a href={siteUrl} target="_blank">
            {siteUrl}
          </a>
        </Button>
      ) : null}
      <Tabs defaultValue="code" className="w-full h-screen">
        <TabsList>
          <TabsTrigger value="code">Code</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>
        <TabsContent value="code" className="space-y-2 h-full">
          <Textarea
            value={htmlStr}
            className="h-full"
            placeholder="Enter your HTML code here..."
            onChange={(e) => setHtmlStr(e.target.value)}
          />
          <Button variant="destructive" onClick={() => setHtmlStr("")}>
            Clear
          </Button>
        </TabsContent>
        <TabsContent value="preview" className="h-full">
          {!isEmpty(htmlStr) ? (
            <div className="space-y-2 h-full">
              <Button
                onClick={() => deploy.mutate({ html: htmlStr })}
                disabled={deploy.isPending}
              >
                {deploy.isPending ? "Deploying…" : "Deploy"}
              </Button>
              <HtmlSandbox code={htmlStr} />
            </div>
          ) : (
            <p>Add some code to see the preview!</p>
          )}
        </TabsContent>
      </Tabs>
    </main>
  );
}
