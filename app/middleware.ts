import { NextResponse } from "vinext/shims/server";

export async function middleware(request: Request) {
    const json = await request.json();

    console.log(json);

    return NextResponse.next();
}
