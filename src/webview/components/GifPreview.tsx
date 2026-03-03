import React, { useState, useEffect } from "react";
import { GifPanelToExtensionCommunicator } from "../communicators/GifPanelToExtensionCommunicator";

const communicator = new GifPanelToExtensionCommunicator();

export function GifPreview() {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");

  useEffect(() => {
    communicator.registerOnPreview((msg) => {
      setUrl(msg.url);
      setTitle(msg.title);
    });
  }, []);

  if (!url) return null;

  return (
    <>
      <img src={url} alt="GIF preview" />
      <p>{title}</p>
    </>
  );
}
