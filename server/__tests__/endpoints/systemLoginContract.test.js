/* eslint-env jest */
const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(
  path.join(__dirname, "../../endpoints/system.js"),
  "utf8"
);

describe("request-token login privacy contract", () => {
  it("equalizes unknown-user work and returns one public invalid-login error", () => {
    expect(source).toContain("dummyHashCompare(password);");
    expect(source.match(/\[001\] Invalid login credentials\./g)).toHaveLength(2);
    expect(source).not.toContain("[002] Invalid login credentials.");
  });
});
