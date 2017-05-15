'use strict';

const structure_template = (`
<section class="title">
  <h1 id="title">{{ title }}</h1>
  <p id="date">{{ date }}</p>
</section>

<br/>

<section class="mainContent">

  <h3>Quote of the Day</h3>
    <p id="quoteText"> <i>{{ quoteText }}</i></p>
    <p id="quoteAuthor">{{ quoteAuthor }}</p>

    <br/>
</section>`);

exports.structure_template = structure_template;
