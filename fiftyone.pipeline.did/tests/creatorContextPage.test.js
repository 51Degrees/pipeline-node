/* *********************************************************************
 * This Original Work is copyright of 51 Degrees Mobile Experts Limited.
 * Copyright 2026 51 Degrees Mobile Experts Limited, Davidson House,
 * Forbury Square, Reading, Berkshire, United Kingdom RG1 3EU.
 *
 * This Original Work is licensed under the European Union Public Licence
 * (EUPL) v.1.2 and is subject to its terms as set out below.
 *
 * If a copy of the EUPL was not distributed with this file, You can obtain
 * one at https://opensource.org/licenses/EUPL-1.2.
 *
 * The 'Compatible Licences' set out in the Appendix to the EUPL (as may be
 * amended by the European Commission) shall be deemed incompatible for
 * the purposes of the Work and the provisions of the compatibility
 * clause in Article 5 of the EUPL shall not apply.
 *
 * If using the Work as, or as part of, a network application, by
 * including the attribution notice(s) required under Article 5 of the EUPL
 * in the end user terms of the application under an appropriate heading,
 * such notice(s) shall fulfill the requirements of that article.
 * ********************************************************************* */

// What the creator context demo page does in a browser, checked by
// running its script with a small stand in for a browser
// (creatorContextPageHarness.js). No browser is started and nothing
// reaches a network.
//
// The service creates a 51Did only once the page has run the snippets it
// asks for and sent what they collected, so a page that asks for one
// directly is told the page has not finished and is given nothing. The
// 51Degrees client script is what runs those snippets, so the page has
// to create through the script and then send what the snippets collected
// with its verification call as well. These tests pin both, because
// neither shows up in a unit test of the demo's server.

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HARNESS = path.join(__dirname, 'creatorContextPageHarness.js');
const PAGE = path.join(
  __dirname, '..', 'examples', 'creator-context-web', 'page.html');

// The licensed probabilistic identifier the stand in client script
// reports, once the page has made it safe for a URL.
const CREATED_URL_SAFE = 'prob-lic_value';

function runPage (given) {
  const args = [HARNESS, PAGE];
  if (given !== undefined) { args.push(given); }
  const printed = execFileSync(process.execPath, args, {
    encoding: 'utf8', timeout: 60000
  });
  const lines = printed.trim().split(/\r?\n/);
  return JSON.parse(lines[lines.length - 1]);
}

function scriptBlock () {
  const page = fs.readFileSync(PAGE, 'utf8');
  // A checkout on Windows has carriage returns in it, so the ends of
  // lines are matched either way.
  const match = page.match(/<script>\r?\n([\s\S]*?)\r?\n<\/script>/);
  expect(match).not.toBeNull();
  return match[1];
}

describe('creator context demo page', () => {
  // A page whose script does not parse defines nothing and reports
  // nothing, and the browser says so only in its console. node --check
  // reads JavaScript rather than HTML, so the page's script block is
  // written out on its own and checked.
  test('the page script parses and runs without error', () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'page-'));
    const file = path.join(folder, 'page-script.js');
    fs.writeFileSync(file, scriptBlock());
    try {
      execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    } finally {
      fs.rmSync(folder, { recursive: true, force: true });
    }
    expect(runPage().errors).toEqual([]);
  });

  // The page asks the cloud for the client script, with the usage and
  // the email address on its address, and takes the identifier from what
  // the script reports.
  test('the identifier comes from the client script', () => {
    const record = runPage();
    expect(record.scripts).toHaveLength(1);
    expect(record.scripts[0]).toContain('TEST-RESOURCE-KEY.js');
    expect(record.scripts[0]).toContain('id.usage=non-marketing');
    expect(record.scripts[0]).toContain('id.email=');
    expect(record.rows['s-create']).toBe('created for this browser');
  });

  // A request of the page's own would be made before the snippets had
  // run, and the service would answer it with no identifier at all.
  test('the page does not ask for an identifier itself', () => {
    for (const address of runPage().fetches) {
      expect(address).not.toContain('json?resource=');
      expect(address).not.toContain('/json');
    }
  });

  // The identifier the script reported is verified, made safe for a URL,
  // and what the snippets collected goes with it, because the service
  // compares this browser against the creator from those values.
  test('the verification carries the identifier and the snippets', () => {
    const verify = runPage().fetches
      .filter((address) => address.includes('id/verify-full'));
    expect(verify).toHaveLength(1);
    expect(verify[0]).toContain(CREATED_URL_SAFE);
    expect(verify[0].split('?')[0]).not.toContain('+');
    expect(verify[0]).toContain('51D_ScreenPixelsHeight=1080');
    expect(verify[0]).toContain('51D_ProfileIds=1-2-3');
    expect(verify[0]).not.toContain('unrelated=ignored');
  });

  // The licence key lives on the server, so the sealed result goes there
  // and the verdict comes back from there.
  test("the result is redeemed on the page's own server", () => {
    const record = runPage();
    const redeem = record.fetches
      .filter((address) => address.startsWith('/redeem?'));
    expect(redeem).toHaveLength(1);
    expect(redeem[0]).toContain('result=sealed-result');
    expect(record.rows['s-signature']).toBe('verified');
    expect(record.rows['s-context']).toBe('verified');
  });

  // The page opened with an identifier from another browser checks that
  // identifier, and still needs this browser's snippet values for the
  // comparison, so the script runs on that path too.
  test('a transplanted identifier still runs the client script', () => {
    const record = runPage('given-value');
    expect(record.scripts).toHaveLength(1);
    const verify = record.fetches
      .filter((address) => address.includes('id/verify-full'));
    expect(verify).toHaveLength(1);
    expect(verify[0]).toContain('given-value');
    expect(verify[0]).toContain('51D_ProfileIds=1-2-3');
  });

  // Someone running the demo is interested in the subject, so the page
  // ends with somewhere to go next. The links to 51degrees.com carry the
  // campaign tags the link lint asks for and the source repositories are
  // given as plain addresses.
  test('the page ends with a Find out more section', () => {
    const page = fs.readFileSync(PAGE, 'utf8');
    expect(page).toContain('Find out more');
    expect(page).toContain('utm_campaign=pipeline-node');
    expect(page).toContain('https://github.com/51Degrees/pipeline-node');
  });
});
