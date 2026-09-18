import { APWebfinger } from "./ap";

export function parseResource(
    resource: string
): [username: string, domain: string] {

    if (!resource.startsWith("acct:")) {
        throw new Error("Invalid resource");
    }

    const acct = resource.slice(5);

    const index = acct.lastIndexOf("@");

    if (index <= 0 || index === acct.length - 1) {
        throw new Error("Invalid acct");
    }

    const username = acct.slice(0, index);
    const domain = acct.slice(index + 1);

    return [username, domain];
}

export function buildWebfinger(
    url: URL,
    username: string,
): APWebfinger {
    const webfinger: APWebfinger = {
        subject: `acct:${username}@${url.host}`,
        aliases: [
            `${url.origin}/@${username}`,
            `${url.origin}/users/${username}`,
        ],
        links: [
            {
                rel: "http://webfinger.net/rel/profile-page",
                type: "text/html",
                href: `${url.origin}/@${username}`
            },
            {
                rel: "self",
                type: "application/activity+json",
                href: `${url.origin}/users/${username}`
            }
        ]
    };

    return webfinger;
}
