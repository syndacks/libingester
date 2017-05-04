'use strict';

const structure_template = (`
<section class="title">
  <h1 id="title">{{ title }}</h1>
  <p id="date">{{ date }}</p>
</section>

<br/>

<section class="mainContent">

  <h3>Word of the Day</h3>
    <h4 id="wordOfDay">{{ wordOfDay }}</h4>
    <p id="wordofDayType"> <i>{{ wordOfDayType }}</i></p>
    <p id="wordofDayDef">Definition: {{ wordOfDayDef }}</p>
    <br/>
</section>`);

exports.structure_template = structure_template;
