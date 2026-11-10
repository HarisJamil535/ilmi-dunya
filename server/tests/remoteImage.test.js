const test = require("node:test");
const assert = require("node:assert");
const { privateAddress, parse, fetchRemoteImage } = require("../src/services/remoteImage");

test("private and local addresses are refused", () => {
    for (const ip of ["127.0.0.1", "10.2.3.4", "192.168.1.1", "172.20.0.1", "169.254.169.254", "0.0.0.0", "::1", "fd00::1", "::ffff:127.0.0.1", "100.64.0.1"]) assert.equal(privateAddress(ip), true, ip);
    for (const ip of ["8.8.8.8", "142.250.1.1", "2606:4700::1111"]) assert.equal(privateAddress(ip), false, ip);
});

test("only full web links are accepted", () => {
    assert.throws(() => parse("ftp://example.com/a.png"));
    assert.throws(() => parse("not a link"));
    assert.throws(() => parse("https://user:pw@example.com/a.png"));
    assert.throws(() => parse("http://127.0.0.1/a.png"));
    assert.throws(() => parse("http://[::1]/a.png"));
    assert.equal(parse("https://example.com/a.png").hostname, "example.com");
});

test("a link whose name resolves to the local machine is refused", async () => {
    await assert.rejects(fetchRemoteImage("http://localhost:5000/logo.png"), /private address/);
});
