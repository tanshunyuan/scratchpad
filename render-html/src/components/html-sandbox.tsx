import { isEmpty } from "lodash-es";
import { useEffect, useRef } from "react";
import sanitize from "sanitize-html";

export const HtmlSandbox = (props: { code: string }) => {
  const { code } = props;
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (isEmpty(iframeRef.current)) return;
    iframeRef.current.srcdoc = code;
  }, [code]);

  return <iframe className="w-full h-full" ref={iframeRef} />;
};
