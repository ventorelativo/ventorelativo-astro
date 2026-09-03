#!/usr/bin/env python3
"""
Round every path in an SVG to whole units, without letting the drift show.

Vector exports carry six decimals of a designer's tool. At the sizes this site
draws them nobody can see the difference, and the file halves.

The catch is that most of a path is *relative* commands, so rounding each delta
on its own accumulates error — over a thousand commands the shape wanders by
tens of pixels. This keeps the exact position alongside the emitted one and
picks each delta so the emitted point lands on the rounded exact point, which
keeps the error bounded at half a unit everywhere.

    python3 scripts/optimise-svg.py in.svg out.svg [decimals]

Run by hand when new artwork arrives, not in the build: the output is committed
and reviewed by looking at it, which is the only way to know a vector still
draws what it drew.
"""
import re, sys, pathlib, gzip
TOKEN = re.compile(r'[A-Za-z]|-?\d*\.?\d+(?:e[-+]?\d+)?')
ARGS = {'m':2,'l':2,'c':6,'s':4,'q':4,'t':2,'h':1,'v':1,'a':7,'z':0}
def fmt(v):
    return f'{v:.0f}' if v == int(v) else f'{v:g}'
def optimise(d, digits=0):
    toks = TOKEN.findall(d); out=[]; i=0
    ex=ey=mx=my=0.0; sx=sy=smx=smy=0.0; cmd=None
    q = (lambda v: round(v, digits)) if digits else (lambda v: float(round(v)))
    while i < len(toks):
        t = toks[i]
        if re.match(r'[A-Za-z]', t):
            cmd = t; i += 1
            if cmd in 'zZ':
                out.append('z'); ex,ey,mx,my = sx,sy,smx,smy; continue
        n = ARGS[cmd.lower()]
        vals = [float(x) for x in toks[i:i+n]]; i += n
        rel = cmd.islower(); c = cmd.lower()
        if c in ('m','l','t'):
            nx,ny = (ex+vals[0], ey+vals[1]) if rel else (vals[0], vals[1])
            tx,ty = q(nx), q(ny)
            out.append(cmd + (f'{fmt(tx-mx)} {fmt(ty-my)}' if rel else f'{fmt(tx)} {fmt(ty)}'))
            ex,ey,mx,my = nx,ny,tx,ty
            if c == 'm': sx,sy,smx,smy = ex,ey,mx,my
        elif c == 'h':
            nx = ex+vals[0] if rel else vals[0]; tx = q(nx)
            out.append(cmd + (f'{fmt(tx-mx)}' if rel else f'{fmt(tx)}')); ex,mx = nx,tx
        elif c == 'v':
            ny = ey+vals[0] if rel else vals[0]; ty = q(ny)
            out.append(cmd + (f'{fmt(ty-my)}' if rel else f'{fmt(ty)}')); ey,my = ny,ty
        elif c in ('c','s','q'):
            pts = [(vals[k], vals[k+1]) for k in range(0,n,2)]
            ab = [(ex+x, ey+y) if rel else (x,y) for x,y in pts]
            rd = [(q(x), q(y)) for x,y in ab]
            body = ' '.join((f'{fmt(x-mx)} {fmt(y-my)}' if rel else f'{fmt(x)} {fmt(y)}') for x,y in rd)
            out.append(cmd + body); ex,ey = ab[-1]; mx,my = rd[-1]
        elif c == 'a':
            rx,ry,rot,laf,sf,x,y = vals
            nx,ny = (ex+x, ey+y) if rel else (x,y); tx,ty = q(nx), q(ny)
            out.append(cmd + f'{fmt(q(rx))} {fmt(q(ry))} {fmt(rot)} {int(laf)} {int(sf)} ' +
                       (f'{fmt(tx-mx)} {fmt(ty-my)}' if rel else f'{fmt(tx)} {fmt(ty)}'))
            ex,ey,mx,my = nx,ny,tx,ty
    s = ''.join(out)
    s = re.sub(r'([\d.]) -', r'\1-', s)
    s = re.sub(r'([a-zA-Z]) ', r'\1', s)
    return s
src = pathlib.Path(sys.argv[1]).read_text()
digits = int(sys.argv[3]) if len(sys.argv) > 3 else 0
out = re.sub(r'd="([^"]+)"', lambda m: 'd="' + optimise(m.group(1), digits) + '"', src)
out = re.sub(r'\s+', ' ', out).replace('> <', '><').strip()
pathlib.Path(sys.argv[2]).write_text(out)
print(f'{sys.argv[1]}: {len(src)} -> {len(out)} raw, {len(gzip.compress(src.encode()))} -> {len(gzip.compress(out.encode()))} gz')
