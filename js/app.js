var DEBUG_DASH_AIRDROP = {};

$(function () {
  'use strict';

  var exampleCsv = [
    '# = 4'
  , '"XjSBXfiAUdrGDJ8TYzSBc2Z5tjexAZao4Q", "7reAg9R74ujxxSj34jpbRpPhfsPt9ytAh3acMehhs1CmfoGFHbh"'
  , '"XunE8skypFR3MHAbu2S3vBZWrWStzQE9f7", "7s8YEQ8LPcCBcWajnwoRYqxCXo5W4AwFrftxQfzoomFGvqYTf8Z"'
  , '"XyGDB8JJhR2s7smACWdWDEV1Lgkg2YeZvH", "7rC9qypu87UCbaDDmAeGGK3JS1TYjLNtT97Nse1E1m7CQaMQSPY"'
  , '"Xsnn4AkwnRDPK3i4CC4MpnhGWcvBKM6bVG", "7qjqyQC7NYWbmRbCq1QfCa3PHZzECjos97WpX3KwWRBc2rxxjcQ"'
  ].join('\n');

  var config = {
    insightBaseUrl: 'https://api.dashdrop.coolaj86.com/insight-api-dash'
  , numWallets: 10
  , fee: 1000 // 1000 // 0 seems to give the "insufficient priority" error
  , serialize: { disableDustOutputs: true, disableSmallFees: true }
  };

  var data = {
    publicKeys: []
  , claimableMap: {}
  , claimable: []
  };

  var bitcore = require('bitcore-lib-dash');
  var privateKey = new bitcore.PrivateKey();
  var wif = privateKey.toWIF();
  var addr = privateKey.toAddress.toString();

  var DashDom = {};
  DashDom._hasBalance = function (pk) {
    return parseInt(localStorage.getItem('dash:' + pk), 10);
  };

  var DashDrop = {};
  DashDrop._toAddress = function (sk) {
    return new bitcore.PrivateKey(sk).toAddress().toString();
  };

  // opts = { utxo, src, dsts, amount, fee }
  DashDrop.load = function (opts) {
    var tx = new bitcore.Transaction();

    opts.dsts.forEach(function (privateKey) {
      tx.to(new bitcore.PrivateKey(privateKey).toAddress(), opts.amount);
    });
    tx.change(new bitcore.PrivateKey(opts.src).toAddress());
    opts.utxos.forEach(function (utxo) {
      tx.from(utxo);
    });
    if ('undefined' !== typeof opts.fee) {
      tx.fee(opts.fee);
    }
    return tx.sign(new bitcore.PrivateKey(opts.src)).serialize({ disableDustOutputs: true, disableSmallFees: true });
  };

  // opts = { utxos, srcs, dst, fee }
  DashDrop.claim = function (opts) {
    var tx = new bitcore.Transaction();
    var addr;
    var sum = 0;
    var total;

    opts.utxos.forEach(function (utxo) {
      sum += utxo.satoshis;
      tx.from(utxo);
    });
    total = sum;

    if ('undefined' !== typeof opts.fee) {
      if (opts.utxos.length > 1) {
        // I'm not actually sure what the fee schedule is, but this worked for me
        opts.fee = Math.max(opts.fee, 2000);
      }
      sum -= (opts.fee);
      tx.fee(opts.fee);
    }

    if (52 === opts.dst.length || 51 === opts.dst.length) {
      addr = new bitcore.PrivateKey(opts.dst).toAddress();
    } else if (34 === opts.dst.length) {
      addr = new bitcore.Address(opts.dst);
    } else {
      throw new Error('unexpected key format');
    }
    //tx.to(addr);
    tx.change(addr);

    opts.srcs.forEach(function (sk) {
      tx.sign(new bitcore.PrivateKey(sk));
    });

    return tx.serialize({ disableDustOutputs: true, disableSmallFees: true });
  };

  console.log('New Key:');
  console.log('Share:', addr);
  console.log('Secret:', wif);
  console.log('');

  //
  // Insight Base URL
  //
  $('.js-insight-base').val(config.insightBaseUrl);
  $('body').on('change', '.js-insight-base', function () {
    config.insightBaseUrl = $('.js-insight-base').val().replace(/\/+$/, '');
    //$('.js-insight-base').text(config.insightBaseUrl);
  });

  //
  // Generate Wallets
  //
  DashDom._getWallets = function () {
    var i;
    var len = localStorage.length;
    var key;
    var wallets = [];

    for (i = 0; i < len; i += 1) {
      key = localStorage.key(i);
      if (/^dash:/.test(key)) {
        wallets.push(key.replace(/^dash:/, ''));
      }
    }

    return wallets;
  };
  DashDom.generateWallets = function () {
    data.privateKeys = DashDom._getWallets().filter(function (key) {
      var val = parseInt(localStorage.getItem('dash:' + key), 10);
      if (!val) {
        return true;
      }
    });
    config.numWallets = $('.js-airdrop-count').val();
    var i;
    var keypair;

    data.publicKeys = [];
    for (i = data.privateKeys.length; i < config.numWallets; i += 1) {
      keypair = new bitcore.PrivateKey();
      data.privateKeys.push( keypair.toWIF() );
    }
    data.privateKeys = data.privateKeys.slice(0, config.numWallets);
    data.privateKeys.forEach(function (wif) {
      keypair = new bitcore.PrivateKey(wif);
      data.publicKeys.push( keypair.toAddress().toString() );
    });

    $('.js-paper-wallet-keys').val(data.publicKeys.join('\n'));
    //$('.js-paper-wallet-keys').val(DashDom._getWallets().join('\n'));
  };

  $('.js-airdrop-count').val(config.numWallets);
  $('.js-airdrop-count').text(config.numWallets);
  DashDom.generateWallets();
  $('body').on('change', '.js-paper-wallet-keys', function () {
    data.publicKeys = [];
    data.publicKeysMap = {};
    data.privateKeys = [];
    $('.js-paper-wallet-keys').val().trim().split(/[,\n\r\s]+/mg).forEach(function (key) {
      key = key.replace(/.*"7/, '7').replace(/".*/, '');
      if (34 === key.length) {
        data.publicKeysMap[key] = true;
        data.publicKeys.push(key);
        console.log('addr', key);
      } else if (52 === key.length || 51 === key.length) {
        localStorage.setItem('dash:' + key, -1);
        data.privateKeys.push(key);
        console.log('skey', key);
      } else {
        console.error("Invalid Key:", key);
      }
    });
    data.privateKeys.forEach(function (skey) {
      var addr = new bitcore.PrivateKey(skey).toAddress().toString();
      data.publicKeysMap[addr] = true;
    });
    data.publicKeys = Object.keys(data.publicKeysMap);

    $('.js-paper-wallet-keys').val(data.publicKeys.join('\n'));
    //$('.js-paper-wallet-keys').val(data.privateKeys.join('\n'));

    $('.js-airdrop-count').val(data.publicKeys.length);
    $('.js-airdrop-count').text(data.publicKeys.length);
    config.numWallets = data.publicKeys.length;

    console.log('private keys:', data.privateKeys);
    console.log('public keys:', data.publicKeys);

    // TODO store in localStorage
  });
  $('body').on('change', '.js-airdrop-count', function () {
    var count = $('.js-airdrop-count').val();
    $('.js-airdrop-count').text(count);
  });
  $('body').on('click', '.js-paper-wallet-generate', DashDom.generateWallets);

  //
  // Load Private Wallet
  //
  DashDom.updatePrivateKey = function () {
    data.wif = $('.js-funding-key').val();
    //localStorage.setItem('private-key', data.wif);
    var addr = new bitcore.PrivateKey(data.wif).toAddress().toString();

    var url = config.insightBaseUrl + '/addrs/:addrs/utxo'.replace(':addrs', addr);
    window.fetch(url, { mode: 'cors' }).then(function (resp) {
      resp.json().then(function (arr) {
        data.sum = 0;
        data.utxos = arr;
        arr.forEach(function (utxo) {
          if (utxo.confirmations >= 6) {
            data.sum += utxo.satoshis;
          } else {
            if (window.confirm("Transaction has not had 6 confirmations yet. Continue?")) {
              data.sum += utxo.satoshis;
            }
          }
        });
        //data.liquid = Math.round(Math.floor((data.sum - config.fee)/1000)*1000);
        data.liquid = data.sum - config.fee;
        $('.js-src-amount').text(data.sum);
        if (!data.amount) {
          data.amount = Math.floor(data.liquid/config.numWallets);
          $('.js-airdrop-amount').val(data.amount);
          $('.js-airdrop-amount').text(data.amount);
        }

        DashDom.updateAirdropAmount();
      });
    });
  };
  DashDom.updateAirdropAmount = function () {
    var err;
    data.amount = parseInt($('.js-airdrop-amount').val(), 10);
    if (!data.sum || data.amount > data.sum) {
      err = new Error("Insufficient Funds: Cannot load " + data.amount + " mDash onto each wallet.");
      window.alert(err.message);
      throw err;
    }
  };

  //data.wif = localStorage.getItem('private-key');
  if (data.wif) {
    $('.js-funding-key').val(data.wif);
    DashDom.updatePrivateKey();
  }
  $('[name=js-fee-schedule]').val(config.fee);
  $('body').on('change', '.js-funding-key', DashDom.updatePrivateKey);
  $('body').on('change', '.js-airdrop-amount', DashDom.updateAirdropAmount);
  $('body').on('click', '.js-airdrop-load', function () {
    /*
    data.privateKeys.forEach(function (sk) {
      var amount = parseInt(localStorage.getItem('dash:' + sk), 10) || 0;
      localStorage.setItem('dash:' + sk, amount);
    });
    */

    var rawTx = DashDrop.load({
      utxos: data.utxos
    , src: data.wif
    , dsts: data.privateKeys.slice()
    , amount: data.amount
    , fee: config.fee
    });
    console.log('transaction:');
    console.log(rawTx);

    var restTx = {
      url: config.insightBaseUrl + '/tx/send'
    , method: 'POST'
    , headers: {
        'Content-Type': 'application/json' //; charset=utf-8
      }
    , body: JSON.stringify({ rawtx: rawTx })
    };

    // TODO don't keep those which were not filled
    data.privateKeys.forEach(function (sk) {
      var amount = parseInt(localStorage.getItem('dash:' + sk), 10) || 0;
      localStorage.setItem('dash:' + sk, amount + data.amount);
    });

    return window.fetch(restTx.url, restTx).then(function (resp) {
      resp.json().then(function (result) {
        console.log('result:');
        console.log(result);
      });
    });
  });

  //
  // Reclaim Wallets
  //
  $('body').on('click', '.js-flow-generate', function () {
    $('.js-flow').addClass('hidden');
    $('.js-flow-generate').removeClass('hidden');
    setTimeout(function () {
      $('.js-flow-generate').addClass('in');
    });
  });
  $('body').on('click', '.js-flow-reclaim', function () {
    $('.js-flow').addClass('hidden');
    $('.js-flow-reclaim').removeClass('hidden');
    setTimeout(function () {
      $('.js-flow-reclaim').addClass('in');
    });
  });
  $('body').on('click', '.js-airdrop-inspect', function () {
    var addrs = DashDom._getWallets().filter(DashDom._hasBalance).map(DashDrop._toAddress).concat(data.publicKeys);
    var addrses = [];
    var ledger = '';

    while (addrs.length) {
      addrses.push(addrs.splice(0, 10));
    };

    function done() {
      $('.js-airdrop-balances code').text(ledger);
      $('.js-airdrop-balances').addClass('in');
    }

    function nextBatch(addrs) {
      if (!addrs) {
        done();
        return;
      }
      var url = config.insightBaseUrl + '/addrs/:addrs/utxo'.replace(':addrs', addrs.join(','));
      window.fetch(url, { mode: 'cors' }).then(function (resp) {
        resp.json().then(function (utxos) {
          console.log('resp.json():');
          console.log(utxos);
          utxos.forEach(function (utxo) {
            if (utxo.confirmations >= 6) {
              ledger += utxo.address + ' ' + utxo.satoshis + ' (' + utxo.confirmations + '+ confirmations)' + '\n';
            } else {
              ledger += utxo.address + ' ' + utxo.satoshis + ' (~' + utxo.confirmations + ' confirmations)' + '\n';
            }
            if (utxo.confirmations >= 6 && utxo.satoshis) {
              if (!data.claimableMap[utxo.address + utxo.txid]) {
                data.claimableMap[utxo.address + utxo.txid] = true;
                data.claimable.push(utxo);
              }
            }
          });

          nextBatch(addrses.shift());
        });
      }, function (err) {
        console.error('Error:');
        console.error(err);
      });
    }
    nextBatch(addrses.shift());
  });

  $('body').on('click', '.js-airdrop-reclaim', function () {
    var txObj = {
      utxos: data.claimable
    , srcs: DashDom._getWallets()
    , dst: data.addr || data.wif
    , fee: config.fee
    };
    var rawTx = DashDrop.claim(txObj);

    console.log('reclaim rawTx:');
    console.log(txObj);
    console.log(rawTx);

    var restTx = {
      url: config.insightBaseUrl + '/tx/send'
    , method: 'POST'
    , headers: {
        'Content-Type': 'application/json' //; charset=utf-8
      }
    , body: JSON.stringify({ rawtx: rawTx })
    };

    return window.fetch(restTx.url, restTx).then(function (resp) {
      resp.json().then(function (result) {
        console.log('result:');
        console.log(result);

        // TODO demote these once the transactions are confirmed?
        /*
        data.privateKeys.forEach(function (sk) {
          localStorage.removeItem('dash:' + sk);
          localStorage.setItem('spent-dash:' + sk, 0);
        });
        */
      });
    });
  });

  var view = {};
  view.csv = {
    toggle: function () {
      console.log('click, csv toggle');
      if ($('.js-csv-view').hasClass('hidden')) {
        $('.js-csv-view').removeClass('hidden');
      } else {
        $('.js-csv-view').addClass('hidden');
      }
    }
  , show: function () {
      $('.js-csv-view').removeClass('hidden');
    }
  , hide: function () {
      $('.js-csv-view').addClass('hidden');
    }
  };

  $('body').on('click', '.js-csv-hide', view.csv.hide);
  $('body').on('click', '.js-csv-show', function () {
    view.csv.show();
    $('.js-paper-wallet-keys').removeAttr('placeholder');
  });
  $('body').on('click', '.js-csv-example', function () {
    view.csv.show();
    $('.js-paper-wallet-keys').attr('placeholder', exampleCsv);
  });
  $('body').on('click', '.js-paper-wallet-print', function () {
    window.print();
  });

  DEBUG_DASH_AIRDROP.config = config;
  DEBUG_DASH_AIRDROP.data = data;
});
