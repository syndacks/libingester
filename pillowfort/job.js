
const crypto = require('crypto');

function new_job_id() {
    const hash = crypto.createHash('sha1');
    hash.update(crypto.randomBytes(32));
    return hash.digest('hex');
}

class SimpleImageJob {
    constructor(uri) {
        this._job_id = new_job_id();
        this._uri = uri;
    }

    get job_id() { return this._job_id; }
    // duck-type
    get asset_id() { return this.job_id; }

    _to_hatch_manifest() {
        return { "job_id": this.job_id, "type": "simple_image", "uri": this._uri };
    }
}

exports.SimpleImageJob = SimpleImageJob;
