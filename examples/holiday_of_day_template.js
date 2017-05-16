'use strict';

const structure_template = (`
<section class="title">
  <h1 id="title">{{ title }}</h1>
  <p id="date">{{ date }}</p>
</section>

<br/>

<section class="mainContent">

  <h3>On this Day in History</h3>
    <p id="todaysHolidayHead">{{ todaysHolidayHead }}</p>
    <p id="todaysHolidayBody">{{ todaysHolidayBody }}</p>
    <p id="todaysHolidayYear">{{ todaysHolidayYear }}</p>

    <br/>
</section>`);

exports.structure_template = structure_template;
