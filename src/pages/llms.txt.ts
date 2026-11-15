export async function GET() {
    const body = `# SynthOmaha

> Community hub for electronic, modular, ambient, and experimental music in Omaha, Nebraska. Musician profiles, event calendar, and workshop booking.

## Pages

- [SynthOmaha](https://synthomaha.net/): Home page with about section, upcoming events, musician profiles, and booking form.

This file is advertised via an HTTP \`Link: </llms.txt>; rel="service-doc"\` response header.
`
    return new Response(body, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
}
