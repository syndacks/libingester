import { Asset, ArticleContentModel } from 'ngest';
import { Cheerio } from 'cheerio';

export default function main(input) {
    const $ = Cheerio.load(input);
    const metadata = {};

    // ...

    return new Asset(new ArticleContentModel(metadata), $.html());
}
