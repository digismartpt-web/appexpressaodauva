#!/usr/bin/env python3
"""TTS proxy server using Microsoft Edge TTS via edge-tts.

Provides a free male Portuguese voice (pt-PT-DuarteNeural / Duarte) that is
not available through the browser Web Speech API on most platforms.
No API key required.

Usage:
    python3 server-tts.py

Endpoints:
    GET /tts?text=...&voice=...
        Returns MP3 audio of the spoken text.
        voice defaults to "pt-PT-DuarteNeural" (male Portuguese)
    GET /health
        Returns OK

    curl "http://localhost:8766/tts?text=Ol%C3%A1+mundo&voice=pt-PT-DuarteNeural"
"""

import asyncio
import logging

import edge_tts
from aiohttp import web

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('tts-server')

DEFAULT_VOICE = 'pt-PT-DuarteNeural'


async def tts_handler(request: web.Request) -> web.Response:
    text = request.query.get('text', '')
    voice = request.query.get('voice', DEFAULT_VOICE)

    if not text:
        return web.Response(status=400, text='Missing "text" query parameter')

    if len(text) > 2000:
        return web.Response(status=400, text='Text too long (max 2000 chars)')

    logger.info('TTS: voice=%s text=%s', voice, text[:80])

    try:
        communicate = edge_tts.Communicate(text, voice)
        audio_data = b''
        async for chunk in communicate.stream():
            if chunk['type'] == 'audio':
                audio_data += chunk['data']

        if not audio_data:
            logger.warning('No audio generated for text=%s', text[:80])
            return web.Response(status=500, text='No audio generated')

        logger.info('Generated %d bytes of audio', len(audio_data))
        return web.Response(
            body=audio_data,
            content_type='audio/mpeg',
            headers={
                'Access-Control-Allow-Origin': '*',
                'Content-Length': str(len(audio_data)),
            },
        )
    except Exception as e:
        logger.error('TTS error: %s', e)
        return web.Response(status=500, text=f'TTS error: {e}')


async def health_handler(request: web.Request) -> web.Response:
    return web.Response(text='OK')


async def list_voices_handler(request: web.Request) -> web.Response:
    """List available voices - useful for discovery."""
    voices = await edge_tts.list_voices()
    pt_voices = [v for v in voices if 'Portuguese' in v.get('FriendlyName', '')]
    return web.json_response(pt_voices or voices)


def main() -> None:
    app = web.Application()
    app.router.add_get('/tts', tts_handler)
    app.router.add_get('/health', health_handler)
    app.router.add_get('/voices', list_voices_handler)

    logger.info('Starting TTS proxy server on http://0.0.0.0:8766')
    web.run_app(app, host='0.0.0.0', port=8766)


if __name__ == '__main__':
    main()
