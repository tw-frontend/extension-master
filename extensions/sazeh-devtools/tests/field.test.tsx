import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { FieldNode } from "../src/core/types";
import { Field } from "../src/popup/Field";

const model: FieldNode = {
  name: "root",
  path: [],
  label: "Configuration",
  kind: "object",
  children: [
    {
      name: "playback",
      path: ["playback"],
      label: "Playback",
      kind: "object",
      children: [
        {
          name: "autoplay",
          path: ["playback", "autoplay"],
          label: "Autoplay",
          kind: "boolean",
        },
      ],
    },
  ],
};

test("nested object fields render as native collapsible categories", () => {
  const html = renderToStaticMarkup(
    <Field
      node={model}
      draft={{ playback: { autoplay: true } }}
      onChange={() => undefined}
      query=""
    />,
  );

  assert.match(html, /<details[^>]*>/);
  assert.match(html, /<summary[^>]*>.*Playback.*<\/summary>/);
  assert.doesNotMatch(html, /<fieldset/);
});

test("a filtered category opens so its matching fields stay visible", () => {
  const html = renderToStaticMarkup(
    <Field
      node={model}
      draft={{ playback: { autoplay: true } }}
      onChange={() => undefined}
      query="autoplay"
    />,
  );

  assert.match(html, /<details[^>]*open=""/);
  assert.match(html, /Autoplay/);
});
