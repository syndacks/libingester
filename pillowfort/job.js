
const crypto = require('crypto');
const SomaProto = require('soma-proto');

function new_job_id() {
    const hash = crypto.createHash('sha1');
    hash.update(crypto.randomBytes(32));
    return hash.digest('hex');
}

class SimpleImageJob {
    constructor(uri) {
        this._job_header = SomaProto.JobHeader.from({
            id: new_job_id(),
            please_queue: false,

            job_type: SomaProto.JobType.values.INGEST_SIMPLE_IMAGE,
            ingest_simple_image_payload: SomaProto.IngestSimpleImagePayload.from({
                uri: uri,
            }),
        });
    }

    get job_id() { return this._job_header.id; }
    // duck-type
    get asset_id() { return this.job_id; }

    _to_hatch_manifest() {
        const proto = SomaProto.JobHeader.encode(this._job_header).finish();
        const proto64 = proto.toString('base64');
        return { "job_id": this.job_id, "proto": proto64 };
    }
}

exports.SimpleImageJob = SimpleImageJob;
